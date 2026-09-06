import { Parser } from "htmlparser2";
import { SaxesParser } from "saxes";
import { fetchPublicSource, MAX_SOURCE_BYTES } from "./public-source.js";

export type SourceItem = { title: string; content: string; link: string; date: string };
const MAX_DEPTH = 128;
const MAX_FEED_ITEMS = 200;
const OMIT_HTML = new Set(["script", "style", "nav", "footer", "header"]);

function checkSize(text: string): void {
  if (Buffer.byteLength(text, "utf8") > MAX_SOURCE_BYTES) throw new Error("Source body is too large to parse");
}

function plainText(html: string): string {
  const parts: string[] = [];
  let excluded = 0;
  let depth = 0;
  const parser = new Parser({
    onopentag(name) {
      if (++depth > MAX_DEPTH) throw new Error("Source HTML nesting limit exceeded");
      if (excluded || OMIT_HTML.has(name)) excluded++;
      else parts.push(" ");
    },
    ontext(text) { if (!excluded) parts.push(text); },
    onclosetag() { if (excluded) excluded--; depth--; if (!excluded) parts.push(" "); },
  }, { decodeEntities: true });
  parser.end(html);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function parseWebpage(html: string, url: string): { title: string; content: string } {
  checkSize(html);
  let title = "";
  let ogTitle = "";
  let heading = "";
  let depth = 0;
  let capture: "title" | "h1" | null = null;
  let captureDepth = 0;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (++depth > MAX_DEPTH) throw new Error("Source HTML nesting limit exceeded");
      if (!capture && ((name === "title" && !title) || (name === "h1" && !heading))) {
        capture = name;
        captureDepth = depth;
      }
      if (name === "meta" && attributes.property?.toLowerCase() === "og:title" && !ogTitle) {
        ogTitle = attributes.content ?? "";
      }
    },
    ontext(text) {
      if (capture === "title") title += text;
      if (capture === "h1") heading += text;
    },
    onclosetag() { if (captureDepth === depth) capture = null; depth--; },
  }, { decodeEntities: true });
  parser.end(html);
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  return {
    title: clean(title) || clean(ogTitle) || clean(heading) || new URL(url).hostname,
    content: plainText(html).slice(0, 10_000),
  };
}

export function parseFeed(xml: string): SourceItem[] {
  checkSize(xml);
  const parser = new SaxesParser({ xmlns: false });
  const stack: string[] = [];
  const items: SourceItem[] = [];
  let fields: Record<string, string> | null = null;
  let itemDepth = 0;
  let field = "";
  let fieldDepth = 0;
  let itemCount = 0;
  parser.on("doctype", () => { throw new Error("Feed document types are not supported"); });
  parser.on("error", (error) => { throw new Error(`Invalid RSS or Atom feed: ${error.message}`); });
  parser.on("opentag", (tag) => {
    const name = tag.name.toLowerCase().split(":").pop()!;
    stack.push(name);
    if (stack.length > MAX_DEPTH) throw new Error("Feed nesting limit exceeded");
    if (name === "item" || name === "entry") {
      if (fields) throw new Error("Nested feed items are not supported");
      if (++itemCount > MAX_FEED_ITEMS) throw new Error("Feed item limit exceeded");
      fields = Object.create(null) as Record<string, string>;
      itemDepth = stack.length;
    } else if (fields && stack.length === itemDepth + 1) {
      field = name;
      fieldDepth = stack.length;
      if (!(field in fields)) fields[field] = "";
      if (name === "link" && typeof tag.attributes.href === "string") {
        const rel = tag.attributes.rel;
        if (!rel || rel === "alternate") fields.link = tag.attributes.href;
      }
    } else if (fields && field && stack.length > fieldDepth) {
      fields[field] += " ";
    }
  });
  const append = (text: string) => { if (fields && field) fields[field] += text; };
  parser.on("text", append);
  parser.on("cdata", append);
  parser.on("closetag", () => {
    if (fields && field && stack.length > fieldDepth) fields[field] += " ";
    if (fields && stack.length === itemDepth) {
      const title = plainText(fields.title || "");
      if (title && title !== "Untitled") {
        items.push({
          title,
          content: plainText(fields.description || fields.content || fields.encoded || fields.summary || "").slice(0, 5_000),
          link: (fields.link || "").trim(),
          date: (fields.pubdate || fields.published || fields.updated || "").trim() || new Date().toISOString(),
        });
      }
      fields = null;
    }
    if (stack.length === fieldDepth) field = "";
    stack.pop();
  });
  parser.write(xml).close();
  return items;
}

export async function scrapeRSS(url: string): Promise<SourceItem[]> {
  // TownNews serves HTML to browser-like user agents; preserve feed-reader negotiation.
  return parseFeed(await fetchPublicSource(url, {
    "User-Agent": "TheCactiBot/1.0 (+https://github.com/anitacigawet/The-Cacti) feedfetcher",
    Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
  }));
}

export async function scrapeWebpage(url: string): Promise<{ title: string; content: string }> {
  return parseWebpage(await fetchPublicSource(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; TheCactiBot/1.0; +https://github.com/anitacigawet/The-Cacti)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }), url);
}
