export type ImpactLevel = "High" | "Medium" | "Low";

export type DocumentFilters = {
  search: string;
  sentiment: string;
  source: string;
  city: string;
  impact: ImpactLevel | "all";
  page: number;
};

export function readDocumentFilters(search: string): DocumentFilters {
  const params = new URLSearchParams(search);
  const impact = params.get("impact");
  const sentiment = params.get("sentiment");
  const page = Number(params.get("page") ?? 1);
  return {
    search: params.get("search") ?? "",
    sentiment: sentiment && ["positive", "neutral", "negative", "mixed"].includes(sentiment) ? sentiment : "all",
    source: params.get("source") || "all",
    city: params.get("city") || "all",
    impact: impact === "High" || impact === "Medium" || impact === "Low" ? impact : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function documentUrl(filters: DocumentFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  for (const key of ["sentiment", "source", "city", "impact"] as const) {
    if (filters[key] !== "all") params.set(key, filters[key]);
  }
  if (filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `/documents?${query}` : "/documents";
}

export function changeDocumentFilters(
  filters: DocumentFilters,
  changes: Partial<Omit<DocumentFilters, "page">>,
): DocumentFilters {
  return { ...filters, ...changes, page: 1 };
}

type DocumentPage<T> = { items: T[]; total: number; totalPages: number };

/** Load every advertised page, with at most four requests in flight. */
export async function loadAllDocumentPages<T extends { id: number }>(
  fetchPage: (input: { page: number; limit: number }) => Promise<DocumentPage<T>>,
): Promise<T[]> {
  const limit = 100;
  const first = await fetchPage({ page: 1, limit });
  const items = [...first.items];
  const pages = Math.max(1, first.totalPages);
  for (let nextPage = 2; nextPage <= pages; nextPage += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - nextPage + 1) }, (_, index) =>
        fetchPage({ page: nextPage + index, limit }),
      ),
    );
    for (const page of batch) {
      if (page.total !== first.total || page.totalPages !== first.totalPages) {
        throw new Error("Documents changed while loading. Try again.");
      }
      items.push(...page.items);
    }
  }
  if (items.length !== first.total || new Set(items.map((item) => item.id)).size !== first.total) {
    throw new Error("The full document list could not be loaded. Try again.");
  }
  return items;
}

export function summarizeDocumentCities(
  documents: Array<{ city: string | null; impactLevel: string | null; sentiment: string | null }>,
) {
  const cities = new Map<string, { docCount: number; highImpactCount: number; sentiments: Map<string, number> }>();
  for (const doc of documents) {
    const name = doc.city || "Mohave County";
    const city = cities.get(name) ?? { docCount: 0, highImpactCount: 0, sentiments: new Map<string, number>() };
    city.docCount++;
    if (doc.impactLevel === "High") city.highImpactCount++;
    if (doc.sentiment) city.sentiments.set(doc.sentiment, (city.sentiments.get(doc.sentiment) ?? 0) + 1);
    cities.set(name, city);
  }
  return Array.from(cities, ([name, city]) => ({
    name,
    docCount: city.docCount,
    alertCount: city.highImpactCount,
    sentiment: [...city.sentiments].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral",
  }));
}
