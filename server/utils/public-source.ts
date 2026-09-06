import { lookup } from "node:dns/promises";
import http, { type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import ipaddr from "ipaddr.js";

export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const CONNECTION_FAILURES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "ETIMEDOUT", "EADDRNOTAVAIL", "EAFNOSUPPORT",
]);
type Address = { address: string; family: number };
type Dependencies = {
  resolve: (hostname: string) => Promise<Address[]>;
  request: (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => http.ClientRequest;
};

export function isPublicAddress(address: string): boolean {
  if (!isIP(address)) return false;
  return ipaddr.process(address).range() === "unicast";
}

export function publicSourceUrl(value: string | URL): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Public sources must use HTTP or HTTPS");
  }
  if (url.username || url.password) throw new Error("Public sources cannot include credentials");
  return url;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
  });
}

function byteLimit(maxBytes: number): Transform {
  let bytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maxBytes ? new Error(`Source response exceeds ${maxBytes} bytes`) : null, chunk);
    },
  });
}

async function readBody(response: IncomingMessage, signal: AbortSignal, maxBytes: number): Promise<string> {
  const size = Number(response.headers["content-length"]);
  if (Number.isFinite(size) && size > maxBytes) {
    response.destroy();
    throw new Error(`Source response exceeds ${maxBytes} bytes`);
  }
  const encoding = String(response.headers["content-encoding"] || "identity").trim().toLowerCase();
  const decompressor = encoding === "gzip" ? createGunzip()
    : encoding === "deflate" ? createInflate()
      : encoding === "br" ? createBrotliDecompress() : null;
  if (!decompressor && encoding !== "identity") {
    response.destroy();
    throw new Error("Unsupported source content encoding");
  }
  const chunks: Buffer[] = [];
  const destination = new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(chunk); callback(); } });
  if (decompressor) {
    await pipeline(response, byteLimit(maxBytes), decompressor, byteLimit(maxBytes), destination, { signal });
  } else {
    await pipeline(response, byteLimit(maxBytes), destination, { signal });
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** The injected dependencies support isolated fixtures, never a production address-policy exception. */
export function createPublicSourceFetcher(dependencies: Partial<Dependencies> = {}) {
  const resolve = dependencies.resolve ?? ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  const request = dependencies.request ?? ((url, options, callback) =>
    (url.protocol === "https:" ? https : http).request(url, options, callback));

  return async function fetchPublicSource(
    value: string,
    headers: Record<string, string>,
    limits: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
  ): Promise<string> {
    const signal = AbortSignal.timeout(limits.timeoutMs ?? SOURCE_TIMEOUT_MS);
    const maxBytes = limits.maxBytes ?? MAX_SOURCE_BYTES;
    let url = publicSourceUrl(value);
    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted();
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await abortable(resolve(hostname), signal);
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
        throw new Error("Public sources must resolve only to public Internet addresses");
      }
      let response: IncomingMessage | undefined;
      let connectionError: unknown;
      // Try only this validated DNS snapshot, once per address, under the same overall deadline.
      for (const pinned of addresses) {
        signal.throwIfAborted();
        try {
          response = await new Promise<IncomingMessage>((resolveResponse, reject) => {
            const req = request(url, {
              method: "GET",
              agent: false,
              signal,
              headers: { ...headers, "Accept-Encoding": "gzip, deflate, br" },
              // Keep the original hostname for Host/TLS; the connection can use only this pinned IP.
              family: pinned.family,
              lookup: (_hostname, options, callback) => {
                if (typeof options === "object" && options.all) callback(null, [pinned]);
                else callback(null, pinned.address, pinned.family);
              },
            }, resolveResponse);
            req.once("error", reject);
            req.end();
          });
          break;
        } catch (error) {
          signal.throwIfAborted();
          if (!CONNECTION_FAILURES.has((error as NodeJS.ErrnoException).code ?? "")) throw error;
          connectionError = error;
        }
      }
      if (!response) throw connectionError;
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (redirects >= (limits.maxRedirects ?? MAX_REDIRECTS)) throw new Error("Too many source redirects");
        const location = response.headers.location;
        if (!location) throw new Error("Source redirect has no location");
        url = publicSourceUrl(new URL(location, url));
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new Error(`HTTP ${status}`);
      }
      return readBody(response, signal, maxBytes);
    }
  };
}

export const fetchPublicSource = createPublicSourceFetcher();
