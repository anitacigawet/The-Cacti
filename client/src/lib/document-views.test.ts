import assert from "node:assert/strict";
import test from "node:test";
import { changeDocumentFilters, documentUrl, loadAllDocumentPages, readDocumentFilters, summarizeDocumentCities } from "./document-views.ts";

test("complete document views include records beyond page three with bounded requests", async () => {
  const source = Array.from({ length: 907 }, (_, id) => ({ id }));
  const requested: number[] = [];
  let inFlight = 0;
  let peak = 0;
  const result = await loadAllDocumentPages(async ({ page, limit }) => {
    requested.push(page);
    peak = Math.max(peak, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    return { items: source.slice((page - 1) * limit, page * limit), total: source.length, totalPages: Math.ceil(source.length / limit) };
  });
  assert.deepEqual(result, source);
  assert.deepEqual(requested, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(peak, 4);
});

test("a failed or inconsistent later page never becomes a partial document view", async () => {
  const first = { items: Array.from({ length: 100 }, (_, id) => ({ id })), total: 101, totalPages: 2 };
  await assert.rejects(loadAllDocumentPages(async ({ page }) => {
    if (page === 2) throw new Error("Page unavailable");
    return first;
  }), /Page unavailable/);
  await assert.rejects(loadAllDocumentPages(async ({ page }) => page === 1 ? first : { items: [{ id: 100 }], total: 102, totalPages: 2 }), /changed while loading/);
  await assert.rejects(loadAllDocumentPages(async ({ page }) => page === 1 ? first : { items: [{ id: 0 }], total: 101, totalPages: 2 }), /full document list/);
});

test("empty datasets do not request more pages", async () => {
  let requests = 0;
  assert.deepEqual(await loadAllDocumentPages(async () => { requests++; return { items: [], total: 0, totalPages: 0 }; }), []);
  assert.equal(requests, 1);
});

test("map city counts use canonical High and include older-page cities", async () => {
  const source = Array.from({ length: 307 }, (_, id) => ({ id, city: id < 300 ? "Kingman" : "Bullhead City", impactLevel: id < 300 ? "Low" : "High", sentiment: "neutral" }));
  const documents = await loadAllDocumentPages(async ({ page, limit }) => ({ items: source.slice((page - 1) * limit, page * limit), total: 307, totalPages: 4 }));
  assert.deepEqual(summarizeDocumentCities(documents), [
    { name: "Kingman", docCount: 300, alertCount: 0, sentiment: "neutral" },
    { name: "Bullhead City", docCount: 7, alertCount: 7, sentiment: "neutral" },
  ]);
});

test("unfiltered and empty query navigation clears every previous filter and page", () => {
  const previous = readDocumentFilters("search=budget&sentiment=positive&source=City&city=Kingman&impact=High&page=7");
  assert.equal(previous.page, 7);
  const empty = { search: "", sentiment: "all", source: "all", city: "all", impact: "all", page: 1 };
  assert.deepEqual(readDocumentFilters(""), empty);
  assert.deepEqual(readDocumentFilters("search=&sentiment=&source=&city=&impact=&page="), empty);
  assert.equal(documentUrl(readDocumentFilters("")), "/documents");
});

test("impact drilldown is a distinct filter and any changed filter resets pagination", () => {
  const filters = readDocumentFilters("search=High+impact&impact=Low&page=7");
  const changed = changeDocumentFilters(filters, { search: "", impact: "High" });
  assert.equal(documentUrl(changed), "/documents?impact=High");
  assert.equal(changed.page, 1);
  assert.deepEqual(readDocumentFilters(documentUrl(changed).split("?")[1]), changed);
  assert.equal(readDocumentFilters("impact=critical&page=-4").impact, "all");
  assert.equal(readDocumentFilters("page=-4").page, 1);
});
