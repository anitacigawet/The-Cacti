import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { createPublicSourceFetcher, isPublicAddress, publicSourceUrl } from "./public-source.js";
import { parseFeed, parseWebpage } from "./source-parsers.js";

type Reply = { body?: string | Buffer; status?: number; headers?: Record<string, string> };
function fixture(replies: Reply[], addresses = [{ address: "93.184.216.34", family: 4 }]) {
  const seen: Array<{ url: string; address: string }> = [];
  const resolved: string[] = [];
  const fetchSource = createPublicSourceFetcher({
    resolve: async (hostname) => { resolved.push(hostname); return addresses; },
    request: (url, options, callback) => {
      const reply = replies.shift();
      assert.ok(reply, "Unexpected source request");
      options.lookup!(url.hostname, {}, (error: any, address: any) => {
        assert.equal(error, null);
        seen.push({ url: url.href, address });
      });
      options.lookup!(url.hostname, { all: true }, (error: any, records: any) => {
        assert.equal(error, null);
        assert.deepEqual(records, [addresses[0]]);
      });
      const req = new EventEmitter() as ClientRequest;
      req.end = (() => {
        queueMicrotask(() => callback(Object.assign(Readable.from([Buffer.from(reply.body ?? "")] ), {
          statusCode: reply.status ?? 200,
          headers: reply.headers ?? {},
        }) as IncomingMessage));
        return req;
      }) as ClientRequest["end"];
      return req;
    },
  });
  return { fetchSource, seen, resolved };
}

test("source policy rejects local, reserved and alternate IP representations", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "192.0.2.1", "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicAddress(publicSourceUrl("http://0x7f000001").hostname), false);
  assert.throws(() => publicSourceUrl("file:///etc/passwd"), /HTTP/);
  assert.throws(() => publicSourceUrl("https://name:password@example.invalid"), /credentials/);
});

test("public source redirects revalidate and pin DNS at every hop", async () => {
  const f = fixture([{ status: 302, headers: { location: "/next" } }, { body: "legitimate" }]);
  assert.equal(await f.fetchSource("https://source.invalid/start", {}), "legitimate");
  assert.deepEqual(f.resolved, ["source.invalid", "source.invalid"]);
  assert.deepEqual(f.seen.map((r) => r.address), ["93.184.216.34", "93.184.216.34"]);
  assert.equal(f.seen[1].url, "https://source.invalid/next");
  for (const location of ["http://127.0.0.1/private", "http://[::ffff:127.0.0.1]/private", "file:///private"]) {
    const blocked = fixture([{ status: 302, headers: { location } }]);
    await assert.rejects(blocked.fetchSource("https://source.invalid/start", {}), /public Internet|HTTP/);
    assert.equal(blocked.seen.length, 1);
  }
  const mixed = fixture([], [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
  await assert.rejects(mixed.fetchSource("https://mixed.invalid/", {}), /public Internet/);
  assert.equal(mixed.seen.length, 0);
  const loop = fixture([{ status: 302, headers: { location: "/again" } }]);
  await assert.rejects(loop.fetchSource("https://source.invalid/", {}, { maxRedirects: 0 }), /redirects/);
});

test("source byte limits cover chunked and compressed bodies while ordinary gzip works", async () => {
  const gzip = gzipSync("legitimate content");
  assert.equal(await fixture([{ body: gzip, headers: { "content-encoding": "gzip" } }]).fetchSource("https://source.invalid/", {}), "legitimate content");
  for (const reply of [
    { body: "x".repeat(100) },
    { body: "x", headers: { "content-length": "100" } },
    { body: gzipSync("x".repeat(1000)), headers: { "content-encoding": "gzip" } },
  ]) {
    await assert.rejects(fixture([reply]).fetchSource("https://source.invalid/", {}, { maxBytes: 50 }), /exceeds/);
  }
  await assert.rejects(fixture([{ body: "x", headers: { "content-encoding": "unknown" } }]).fetchSource("https://source.invalid/", {}), /Unsupported/);
});

test("public source retries unavailable IPv6 on validated IPv4 without resolving DNS again", async () => {
  for (const allFail of [false, true]) {
    const addresses = [{ address: "2606:4700:4700::1111", family: 6 }, { address: "93.184.216.34", family: 4 }];
    let resolutions = 0;
    const attempted: string[] = [];
    const fetchSource = createPublicSourceFetcher({
      resolve: async () => { resolutions++; return addresses; },
      request: (url, options, callback) => {
        assert.equal(url.hostname, "dual-stack.invalid");
        let pinned = "";
        options.lookup!(url.hostname, {}, (error: any, address: any) => { assert.equal(error, null); pinned = address; });
        attempted.push(pinned);
        const req = new EventEmitter() as ClientRequest;
        req.end = (() => {
          queueMicrotask(() => {
            if (options.family === 6 || allFail) {
              req.emit("error", Object.assign(new Error("Synthetic unreachable address"), { code: "ENETUNREACH" }));
            } else {
              callback(Object.assign(Readable.from([Buffer.from("IPv4 response")]), { statusCode: 200, headers: {} }) as IncomingMessage);
            }
          });
          return req;
        }) as ClientRequest["end"];
        return req;
      },
    });
    if (allFail) await assert.rejects(fetchSource("https://dual-stack.invalid/", {}), { code: "ENETUNREACH" });
    else assert.equal(await fetchSource("https://dual-stack.invalid/", {}), "IPv4 response");
    assert.deepEqual(attempted, addresses.map(({ address }) => address));
    assert.equal(resolutions, 1);
  }
});

test("public source does not retry another address after an HTTP response or invalid body", async () => {
  const addresses = [{ address: "2606:4700:4700::1111", family: 6 }, { address: "93.184.216.34", family: 4 }];
  for (const reply of [{ status: 500 }, { body: "x".repeat(100) }, { body: "broken gzip", headers: { "content-encoding": "gzip" } }]) {
    const f = fixture([reply], addresses);
    await assert.rejects(f.fetchSource("https://dual-stack.invalid/", {}, { maxBytes: 50 }));
    assert.equal(f.seen.length, 1);
    assert.equal(f.resolved.length, 1);
  }
});

test("source global deadline includes DNS resolution", async () => {
  const fetchSource = createPublicSourceFetcher({
    resolve: async () => new Promise((resolve) => setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 40)),
    request: () => { throw new Error("Request must not follow timed-out DNS"); },
  });
  await assert.rejects(fetchSource("https://source.invalid/", {}, { timeoutMs: 5 }), /timeout|aborted/i);
});

test("redirected host DNS cannot rebind to private addresses", async () => {
  let resolutions = 0;
  let requests = 0;
  const fetchSource = createPublicSourceFetcher({
    resolve: async () => ++resolutions === 1 ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "10.0.0.1", family: 4 }],
    request: (_url, _options, callback) => {
      requests++;
      const req = new EventEmitter() as ClientRequest;
      req.end = (() => {
        queueMicrotask(() => callback(Object.assign(Readable.from([]), { statusCode: 302, headers: { location: "https://other.invalid/" } }) as IncomingMessage));
        return req;
      }) as ClientRequest["end"];
      return req;
    },
  });
  await assert.rejects(fetchSource("https://source.invalid/", {}), /public Internet/);
  assert.equal(resolutions, 2);
  assert.equal(requests, 1);
});

test("source deadline also cancels a slowly streamed response body", async () => {
  const fetchSource = createPublicSourceFetcher({
    request: (_url, _options, callback) => {
      const req = new EventEmitter() as ClientRequest;
      req.end = (() => {
        const body = new Readable({ read() {} });
        const delayed = setTimeout(() => { body.push(Buffer.from("late")); body.push(null); }, 40);
        body.once("close", () => clearTimeout(delayed));
        queueMicrotask(() => callback(Object.assign(body, { statusCode: 200, headers: {} }) as IncomingMessage));
        return req;
      }) as ClientRequest["end"];
      return req;
    },
  });
  await assert.rejects(fetchSource("https://93.184.216.34/", {}, { timeoutMs: 5 }), /aborted|timeout/i);
});

test("maintained feed parser preserves RSS CDATA and Atom variants", () => {
  const rss = parseFeed('<rss><channel><item><title><![CDATA[Road & bridge]]></title><description><![CDATA[<p>A <b>public</b> meeting.</p>]]></description><link>https://source.invalid/item?a=1&amp;b=2</link><pubDate>2026-09-05T00:00:00Z</pubDate></item></channel></rss>');
  assert.deepEqual(rss, [{ title: "Road & bridge", content: "A public meeting.", link: "https://source.invalid/item?a=1&b=2", date: "2026-09-05T00:00:00Z" }]);
  const atom = parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>City update</title><summary>Public &amp; local</summary><link rel="self" href="https://source.invalid/self"/><link href="https://source.invalid/article" rel="alternate"/><updated>2026-09-04T00:00:00Z</updated></entry></feed>');
  assert.deepEqual(atom, [{ title: "City update", content: "Public & local", link: "https://source.invalid/article", date: "2026-09-04T00:00:00Z" }]);
  const xhtml = parseFeed('<feed><entry><title>Meeting</title><content type="xhtml"><div><p>First paragraph</p><p>Second paragraph</p></div></content></entry></feed>');
  assert.equal(xhtml[0].content, "First paragraph Second paragraph");
  assert.deepEqual(parseFeed("<rss><channel/></rss>"), []);
});

test("malformed item/entry bodies, DTDs and parser resource limits fail explicitly", () => {
  for (const tag of ["item", "entry"]) {
    assert.throws(() => parseFeed(`<rss>${`<${tag}>`.repeat(16_000)}`), /Nested feed|Invalid RSS/);
  }
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///private">]><rss/>'), /document types/);
  assert.throws(() => parseFeed(`<rss>${"<x>".repeat(130)}</rss>`), /nesting/);
  assert.throws(() => parseFeed(`<rss>${"<item><title>t</title></item>".repeat(201)}</rss>`), /item limit/);
  assert.throws(() => parseFeed("x".repeat(2 * 1024 * 1024 + 1)), /too large/);
});

test("webpage parser preserves title fallback and readable content without scripts", () => {
  const page = parseWebpage('<html><head><title> \n </title><meta content="Council &amp; budget" property="og:title"></head><body><nav>Hidden menu</nav><h1>Heading</h1><p>Public <b>meeting</b>.</p><script>hidden()</script></body></html>', "https://source.invalid/");
  assert.equal(page.title, "Council & budget");
  assert.match(page.content, /Public meeting/);
  assert.doesNotMatch(page.content, /Hidden menu|hidden\(\)/);
  assert.equal(parseWebpage("<h1>Only heading</h1>", "https://source.invalid/").title, "Only heading");
  assert.equal(parseWebpage("<p>Only content</p>", "https://source.invalid/").title, "source.invalid");
});
