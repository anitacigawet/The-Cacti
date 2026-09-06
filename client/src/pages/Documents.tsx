import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Search, Filter, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMemo, useCallback } from "react";
import { changeDocumentFilters, documentUrl, readDocumentFilters, type DocumentFilters } from "@/lib/document-views";
import { SentimentTag, ImpactTag, CityTag, SourceTag } from "@/components/MetaTag";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#06b6d4",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

// Highlight search terms in text
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;

  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (terms.length === 0) return <>{text}</>;

  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some((t) => part.toLowerCase() === t.toLowerCase());
        return isMatch ? (
          <mark
            key={i}
            className="bg-primary/30 text-primary rounded-sm px-0.5 font-medium"
            style={{ textDecoration: "none" }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export default function Documents() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const filters = useMemo(() => readDocumentFilters(searchString), [searchString]);
  const { search, sentiment: sentimentFilter, source: sourceFilter, city: cityFilter, impact: impactFilter, page } = filters;
  const pageSize = 20;
  const updateFilters = (changes: Partial<Omit<DocumentFilters, "page">>) => {
    setLocation(documentUrl(changeDocumentFilters(filters, changes)), { replace: true });
  };
  const setPage = (nextPage: number) => setLocation(documentUrl({ ...filters, page: nextPage }));

  const docs = trpc.documents.list.useQuery({
    page,
    limit: pageSize,
    search: search || undefined,
    sentiment: sentimentFilter !== "all" ? sentimentFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    city: cityFilter !== "all" ? cityFilter : undefined,
    impactLevel: impactFilter !== "all" ? impactFilter : undefined,
  });

  const sources = trpc.analytics.sourceBreakdown.useQuery();
  const filterOptions = trpc.documents.filterOptions.useQuery();
  const uniqueSources = useMemo(
    () => (sources.data || []).map((s: { source: string; count: number }) => s.source),
    [sources.data]
  );
  const uniqueCities = useMemo(
    () => filterOptions.data?.cities || [],
    [filterOptions.data]
  );

  const totalPages = docs.data?.totalPages ?? 1;

  const hasActiveFilters = search || sentimentFilter !== "all" || sourceFilter !== "all" || cityFilter !== "all" || impactFilter !== "all";

  const clearAllFilters = useCallback(() => {
    setLocation("/documents");
  }, [setLocation]);

  return (
    <CactiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-xl md:text-2xl tracking-wider text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            DOCUMENTS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and search collected civic documents
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3" data-tour="documents-search">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-10 bg-card border-border"
              />
            </div>
            <Select
              value={sentimentFilter}
              onValueChange={(sentiment) => updateFilters({ sentiment })}
            >
              <SelectTrigger className="w-[200px] bg-card border-border">
                <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sourceFilter}
              onValueChange={(source) => updateFilters({ source })}
            >
              <SelectTrigger className="w-[200px] bg-card border-border">
                <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map((s: string) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cityFilter}
              onValueChange={(city) => updateFilters({ city })}
            >
              <SelectTrigger className="w-[200px] bg-card border-border">
                <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map((c: string) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={impactFilter}
              onValueChange={(impact) => {
                if (impact === "all" || impact === "High" || impact === "Medium" || impact === "Low") {
                  updateFilters({ impact });
                }
              }}
            >
              <SelectTrigger className="w-[200px] bg-card border-border" aria-label="Impact">
                <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact Levels</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                ACTIVE FILTERS:
              </span>
              {search && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5 border-primary/30 text-primary">
                  Search: {search}
                  <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => updateFilters({ search: "" })} />
                </Badge>
              )}
              {sentimentFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5" style={{ borderColor: SENTIMENT_COLORS[sentimentFilter], color: SENTIMENT_COLORS[sentimentFilter] }}>
                  {sentimentFilter}
                  <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => updateFilters({ sentiment: "all" })} />
                </Badge>
              )}
              {sourceFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5 border-cacti-cyan/50 text-cacti-cyan">
                  {sourceFilter}
                  <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => updateFilters({ source: "all" })} />
                </Badge>
              )}
              {cityFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5 border-cacti-green/50 text-cacti-green">
                  {cityFilter}
                  <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => updateFilters({ city: "all" })} />
                </Badge>
              )}
              {impactFilter !== "all" && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5">
                  {impactFilter} impact
                  <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => updateFilters({ impact: "all" })} />
                </Badge>
              )}
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <span
            className="text-xs text-muted-foreground tracking-wider"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {docs.data?.total ?? 0} DOCUMENTS FOUND
            {search && (
              <span className="text-primary ml-2">
                matching &quot;{search}&quot;
              </span>
            )}
          </span>
        </div>

        {/* Document List */}
        {docs.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (docs.data?.items ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-30 mb-4" />
            <p className="text-sm">No documents found</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs mt-2 text-primary hover:underline"
              >
                Clear filters and try again
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(docs.data?.items ?? []).map((doc: any) => (
              <Card
                key={doc.id}
                className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => setLocation(`/documents/${doc.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-foreground line-clamp-1">
                          <HighlightedText
                            text={doc.title || "Untitled Document"}
                            query={search}
                          />
                        </h3>
                        <span
                          className="text-[10px] text-muted-foreground shrink-0"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {doc.publishedDate ? new Date(doc.publishedDate).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <HighlightedText
                          text={doc.summary || doc.content?.substring(0, 200) || "No content preview available"}
                          query={search}
                        />
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <SentimentTag value={doc.sentiment} />
                        <ImpactTag value={doc.impactLevel} />
                        {doc.city && <CityTag value={doc.city} />}
                        {doc.source && <SourceTag value={doc.source} />}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="text-xs text-muted-foreground px-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </CactiLayout>
  );
}
