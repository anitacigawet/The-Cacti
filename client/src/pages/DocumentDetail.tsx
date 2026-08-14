import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SentimentTag, ImpactTag } from "@/components/MetaTag";
import {
  ArrowLeft,
  ExternalLink,
  Brain,
  Tag,
  AlertTriangle,
  CheckCircle,
  Users,
  MapPin,
  Building,
  Calendar,
  DollarSign,
  Clock,
} from "lucide-react";
import { useLocation, useParams } from "wouter";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#06b6d4",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  person: Users,
  people: Users,
  organization: Building,
  organizations: Building,
  location: MapPin,
  locations: MapPin,
  "dates/times": Calendar,
  date: Calendar,
  money: DollarSign,
};

/** Safely convert any value to a displayable string */
function toDisplayString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    // For objects like {Event: "...", Date: "...", Location: "..."}
    // join key-value pairs into a readable string
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return "";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" · ");
  }
  return String(val);
}

/** Safely convert entity items to string array */
function toStringArray(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => toDisplayString(item)).filter(Boolean);
}

export default function DocumentDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const doc = trpc.documents.detail.useQuery({ id: parseInt(params.id || "0", 10) });

  if (doc.isLoading) {
    return (
      <CactiLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </CactiLayout>
    );
  }

  if (!doc.data) {
    return (
      <CactiLayout>
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <p className="text-muted-foreground">Document not found</p>
          <Button variant="outline" onClick={() => setLocation("/documents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </div>
      </CactiLayout>
    );
  }

  const d = doc.data;
  const sentimentColor =
    SENTIMENT_COLORS[d.analysis?.sentiment?.Overall?.toLowerCase() || ""] ||
    "#666";

  return (
    <CactiLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/documents")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>

        {/* Document Header */}
        <div className="space-y-3">
          <h1 className="text-xl md:text-2xl font-medium text-foreground leading-snug">
            {d.title}
          </h1>
          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
            <span>{d.source}</span>
            <span>&middot;</span>
            <span>{d.city}</span>
            <span>&middot;</span>
            <span>
              {d.publishedDate
                ? new Date(d.publishedDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Unknown date"}
            </span>
            {d.sourceUrl && (
              <>
                <span>&middot;</span>
                <a
                  href={d.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* AI Analysis Section */}
        {d.analysis && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-primary" />
                <span
                  className="tracking-wider text-primary uppercase"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "12px",
                  }}
                >
                  AI Analysis
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              {d.analysis.summary && (
                <div className="space-y-1">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                    }}
                  >
                    Summary
                  </p>
                  <p className="text-[15px] text-foreground leading-relaxed">
                    {d.analysis.summary}
                  </p>
                </div>
              )}

              <Separator className="bg-border" />

              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Sentiment */}
                <div className="space-y-1">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                    }}
                  >
                    Sentiment
                  </p>
                  <SentimentTag value={d.analysis.sentiment?.Overall} />
                  {d.analysis.sentiment?.Score != null && (
                    <p className="text-xs text-muted-foreground">
                      Score: {d.analysis.sentiment.Score}
                    </p>
                  )}
                </div>

                {/* Impact */}
                <div className="space-y-1">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                    }}
                  >
                    Impact Level
                  </p>
                  <ImpactTag value={d.analysis.impactLevel} />
                </div>

                {/* Categories */}
                <div className="space-y-1">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                    }}
                  >
                    Categories
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(d.analysis.categories || []).map((c: string) => (
                      <Badge key={c} variant="secondary" className="text-[11px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Topics */}
                <div className="space-y-1">
                  <p
                    className="text-xs text-muted-foreground uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                    }}
                  >
                    Key Topics
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(d.analysis.topics || []).map((t: string) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[11px]"
                      >
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Items - safely handle both string and object items */}
              {Array.isArray(d.analysis.actionItems) && d.analysis.actionItems.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div className="space-y-2">
                    <p
                      className="text-xs text-muted-foreground uppercase tracking-wider"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                      }}
                    >
                      Action Items
                    </p>
                    <div className="space-y-2">
                      {d.analysis.actionItems.map(
                        (item: unknown, i: number) => {
                          const displayText = toDisplayString(item);
                          if (!displayText) return null;
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-2 p-2 rounded bg-cacti-surface-light/50"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-cacti-green mt-0.5 shrink-0" />
                              <span className="text-sm text-foreground leading-relaxed">
                                {displayText}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Entities - safely handle nested objects */}
        {d.entities && Object.keys(d.entities).length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-cacti-purple" />
                <span
                  className="tracking-wider text-cacti-purple uppercase"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "12px",
                  }}
                >
                  Entities
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(
                  d.entities as Record<string, unknown>
                ).map(([type, rawItems]) => {
                  const items = toStringArray(rawItems);
                  const Icon =
                    ENTITY_ICONS[type.toLowerCase()] || Users;
                  if (items.length === 0) return null;
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span
                          className="text-xs text-muted-foreground capitalize tracking-wider"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                          }}
                        >
                          {type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((name: string, i: number) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Content */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle
              className="text-xs tracking-wider text-muted-foreground uppercase"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              Full Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
                {d.cleanedContent || d.content || "No content available"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </CactiLayout>
  );
}
