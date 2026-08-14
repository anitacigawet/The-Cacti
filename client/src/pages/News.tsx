import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CactiLayout from "@/components/CactiLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Newspaper,
  RefreshCw,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Zap,
  FileText,
} from "lucide-react";
import { CactiLogo } from "@/components/CactiLogo";
import { isStillBreaking } from "@/lib/news";

const CITY_COLORS: Record<string, string> = {
  Kingman: "text-cacti-cyan",
  "Bullhead City": "text-cacti-green",
  "Lake Havasu City": "text-cacti-amber",
  "Mohave County": "text-cacti-purple",
};

const CITY_BG: Record<string, string> = {
  Kingman: "bg-cacti-cyan/10 border-cacti-cyan/30",
  "Bullhead City": "bg-cacti-green/10 border-cacti-green/30",
  "Lake Havasu City": "bg-cacti-amber/10 border-cacti-amber/30",
  "Mohave County": "bg-cacti-purple/10 border-cacti-purple/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  government: "Government",
  public_safety: "Public Safety",
  infrastructure: "Infrastructure",
  environment: "Environment",
  education: "Education",
  economy: "Economy",
  community: "Community",
  health: "Health",
};

const CATEGORY_ICONS: Record<string, string> = {
  government: "🏛️",
  public_safety: "🚨",
  infrastructure: "🏗️",
  environment: "🌿",
  education: "📚",
  economy: "📈",
  community: "🤝",
  health: "🏥",
};

type NewsArticle = {
  id: number;
  headline: string;
  summary: string;
  body: string;
  whyItMatters: string | null;
  city: string;
  category: string;
  importance: number;
  citations: any;
  metadata: any;
  isBreaking: boolean | number;
  edition: string;
  tokensUsed: number | null;
  createdAt: string | Date;
};

function parseCitations(citations: any): Array<{ documentId: string; title: string; source: string; date: string }> {
  if (!citations) return [];
  try {
    if (typeof citations === "string") return JSON.parse(citations);
    if (Array.isArray(citations)) return citations;
    return [];
  } catch {
    return [];
  }
}

function formatRelative(when: string | Date | undefined): string {
  if (!when) return "";
  const t = new Date(when).getTime();
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function BreakingBanner({ articles }: { articles: NewsArticle[] }) {
  // Cap the surfaced count — if every story is "breaking" the word loses
  // meaning. Top 3 by importance keeps the block scannable and lets the
  // rest of the page do its job. Counter is shown in the header so the
  // user knows more exist if they scroll.
  //
  // Stale-breaking guard: also drop anything older than 48h regardless of
  // what the DB says. "Breaking" is a freshness claim — a story tagged
  // breaking 11 days ago isn't breaking news anymore, even if the LLM
  // labeled it so. This protects against legacy data and against future
  // prompt regressions.
  const allBreaking = articles
    .filter(isStillBreaking)
    .sort((a, b) => (b.importance || 5) - (a.importance || 5));
  if (allBreaking.length === 0) return null;
  const breaking = allBreaking.slice(0, 3);
  const overflow = allBreaking.length - breaking.length;

  return (
    <div className="bg-cacti-red/10 border border-cacti-red/30 rounded-lg overflow-hidden mb-6">
      <div className="flex items-center justify-between px-3 py-1.5 bg-cacti-red/15 border-b border-cacti-red/20">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cacti-red opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cacti-red" />
          </span>
          <span
            className="text-[10px] font-bold tracking-widest text-cacti-red uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Breaking · {allBreaking.length}
          </span>
        </div>
        {overflow > 0 && (
          <span
            className="text-[10px] text-muted-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +{overflow} more below
          </span>
        )}
      </div>
      <ul className="divide-y divide-cacti-red/15">
        {breaking.map((a) => (
          <li key={a.id} className="px-3 py-2 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {a.headline}
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 shrink-0 text-[10px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className={CITY_COLORS[a.city] || "text-muted-foreground"}>
                {a.city}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground/70">{formatRelative(a.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroArticle({
  article,
  onRead,
}: {
  article: NewsArticle;
  onRead: (id: number) => void;
}) {
  const citations = parseCitations(article.citations);
  return (
    <div
      className="cacti-card p-6 cursor-pointer hover:border-primary/50 transition-all group"
      onClick={() => onRead(article.id)}
    >
      <div className="flex items-center gap-2 mb-3">
        {isStillBreaking(article) ? (
          <Badge variant="destructive" className="text-xs">
            <Zap className="h-3 w-3 mr-1" /> BREAKING
          </Badge>
        ) : null}
        <Badge variant="outline" className={`text-xs border ${CITY_BG[article.city] || ""}`}>
          <MapPin className="h-3 w-3 mr-1" />
          {article.city}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {CATEGORY_ICONS[article.category] || "📰"} {CATEGORY_LABELS[article.category] || article.category}
        </Badge>
      </div>
      <h2
        className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {article.headline}
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed mb-4">{article.summary}</p>
      {article.whyItMatters && (
        <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>
              Why This Matters
            </span>
          </div>
          <p className="text-sm text-foreground/80">{article.whyItMatters}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {citations.length} source{citations.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {article.edition}
          </span>
        </div>
        <span className="text-xs text-primary flex items-center gap-1 group-hover:underline">
          Read full story <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function NewsCard({
  article,
  onRead,
}: {
  article: NewsArticle;
  onRead: (id: number) => void;
}) {
  const citations = parseCitations(article.citations);
  return (
    <div
      className="cacti-card p-4 cursor-pointer hover:border-primary/40 transition-all group h-full flex flex-col"
      onClick={() => onRead(article.id)}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {isStillBreaking(article) ? (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            <Zap className="h-2.5 w-2.5 mr-0.5" /> BREAKING
          </Badge>
        ) : null}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${CITY_BG[article.city] || ""}`}>
          {article.city}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {CATEGORY_ICONS[article.category] || "📰"} {CATEGORY_LABELS[article.category] || article.category}
        </Badge>
      </div>
      <h3
        className="text-lg font-bold mb-2 group-hover:text-primary transition-colors leading-snug flex-grow"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {article.headline}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{article.summary}</p>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {citations.length} source{citations.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-primary flex items-center gap-1 group-hover:underline">
          Read <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function ArticleDetail({
  article,
  onBack,
}: {
  article: NewsArticle;
  onBack: () => void;
}) {
  const [, navigate] = useLocation();
  const citations = parseCitations(article.citations);

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to News
      </Button>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {isStillBreaking(article) ? (
          <Badge variant="destructive">
            <Zap className="h-3 w-3 mr-1" /> BREAKING
          </Badge>
        ) : null}
        <Badge variant="outline" className={`border ${CITY_BG[article.city] || ""}`}>
          <MapPin className="h-3 w-3 mr-1" />
          {article.city}
        </Badge>
        <Badge variant="outline">
          {CATEGORY_ICONS[article.category] || "📰"} {CATEGORY_LABELS[article.category] || article.category}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
          <Clock className="h-3 w-3" />
          {article.edition}
        </span>
      </div>

      <h1
        className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {article.headline}
      </h1>

      <p className="text-lg text-muted-foreground mb-6 leading-relaxed border-l-2 border-primary/40 pl-4">
        {article.summary}
      </p>

      {/* Article body */}
      <div className="prose prose-invert prose-sm max-w-none mb-6 article-body">
        {article.body.split("\n").map((paragraph, i) => {
          if (paragraph.startsWith("## ")) {
            return (
              <h2
                key={i}
                className="text-xl font-bold mt-6 mb-3 text-foreground"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {paragraph.replace("## ", "")}
              </h2>
            );
          }
          if (paragraph.startsWith("### ")) {
            return (
              <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-foreground">
                {paragraph.replace("### ", "")}
              </h3>
            );
          }
          if (paragraph.trim() === "") return null;
          return (
            <p key={i} className="text-foreground/90 leading-relaxed mb-3">
              {paragraph}
            </p>
          );
        })}
      </div>

      {/* Why It Matters */}
      {article.whyItMatters && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span
              className="text-sm font-bold text-primary uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Why This Matters
            </span>
          </div>
          <p className="text-foreground/80 leading-relaxed">{article.whyItMatters}</p>
        </div>
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <div className="border border-border/40 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Sources ({citations.length})
            </span>
          </div>
          <div className="space-y-2">
            {citations.map((cite: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm cursor-pointer hover:text-primary transition-colors group/cite"
                onClick={() => navigate(`/documents/${cite.documentId}`)}
              >
                <span className="text-muted-foreground font-mono text-xs mt-0.5">[{i + 1}]</span>
                <div>
                  <span className="group-hover/cite:underline">{cite.title}</span>
                  <span className="text-muted-foreground text-xs ml-2">
                    — {cite.source} {cite.date ? `(${cite.date})` : ""}
                  </span>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto mt-0.5 opacity-0 group-hover/cite:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function News() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  const { data: articles, isLoading, refetch } = trpc.news.list.useQuery({
    limit: 50,
    city: selectedCity || undefined,
  });

  const generateMutation = trpc.news.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.articleCount} articles for edition ${data.edition}`);
      refetch();
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const generateAllMutation = trpc.news.generateAll.useMutation({
    onSuccess: (data) => {
      const cityDetails = Object.entries(data.cityCounts || {})
        .map(([city, count]) => `${city}: ${count}`)
        .join(", ");
      toast.success(`Generated ${data.articleCount} articles across all cities (${cityDetails})`);
      refetch();
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const isGenerating = generateMutation.isPending || generateAllMutation.isPending;

  const selectedArticle = useMemo(() => {
    if (!selectedArticleId || !articles) return null;
    return articles.find((a: any) => a.id === selectedArticleId) || null;
  }, [selectedArticleId, articles]);

  const sortedArticles = useMemo(() => {
    if (!articles) return [];
    return [...articles].sort((a: any, b: any) => {
      const aBreak = isStillBreaking(a);
      const bBreak = isStillBreaking(b);
      if (aBreak && !bBreak) return -1;
      if (!aBreak && bBreak) return 1;
      return (b.importance || 5) - (a.importance || 5);
    });
  }, [articles]);

  const heroArticle = sortedArticles[0];
  const restArticles = sortedArticles.slice(1);

  const cities = ["Kingman", "Bullhead City", "Lake Havasu City", "Mohave County"];

  return (
    <CactiLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {selectedArticle ? (
          <ArticleDetail
            article={selectedArticle as NewsArticle}
            onBack={() => setSelectedArticleId(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <CactiLogo size={40} />
                <div>
                  <h1
                    className="text-2xl md:text-3xl font-bold tracking-wider text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    THE CACTI <span className="text-foreground/70">— NEWS FEED</span>
                  </h1>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    AI-Generated Mohave County Intelligence Feed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/newspaper")}
                  className="border-primary/30 hover:border-primary/60"
                >
                  <Newspaper className="h-4 w-4 mr-1" />
                  The Cacti Edition
                </Button>
                {user && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => generateAllMutation.mutate()}
                      disabled={isGenerating}
                      className="bg-cacti-green/20 hover:bg-cacti-green/30 text-cacti-green border border-cacti-green/30"
                    >
                      {generateAllMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      {generateAllMutation.isPending ? "Generating All..." : "Generate All Cities"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => generateMutation.mutate({})}
                      disabled={isGenerating}
                      className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                    >
                      {generateMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      {generateMutation.isPending ? "Generating..." : "Generate News"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* City filter tabs */}
            <div className="flex items-center gap-2 mb-6 cacti-scroll-x pb-2">
              <Button
                variant={selectedCity === null ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedCity(null)}
                className={selectedCity === null ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground"}
              >
                All Cities
              </Button>
              {cities.map((city) => (
                <Button
                  key={city}
                  variant={selectedCity === city ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCity(city)}
                  className={
                    selectedCity === city
                      ? `bg-primary/20 text-primary border border-primary/30`
                      : "text-muted-foreground"
                  }
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {city}
                </Button>
              ))}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 rounded-lg" />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && sortedArticles.length === 0 && (
              <div className="cacti-card p-12 text-center">
                <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                  No News Articles Yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Click "Generate News" to create AI-written articles from the latest civic intelligence data.
                </p>
                {user && (
                  <Button
                    onClick={() => generateAllMutation.mutate()}
                    disabled={isGenerating}
                    className="bg-cacti-green/20 hover:bg-cacti-green/30 text-cacti-green border border-cacti-green/30"
                  >
                    {isGenerating ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    {isGenerating ? "Generating..." : "Generate All Cities"}
                  </Button>
                )}
              </div>
            )}

            {/* Breaking news banner */}
            {sortedArticles.length > 0 && <BreakingBanner articles={sortedArticles as NewsArticle[]} />}

            {/* Hero article */}
            {heroArticle && (
              <div className="mb-6" data-tour="news-feed-list">
                <HeroArticle
                  article={heroArticle as NewsArticle}
                  onRead={(id) => setSelectedArticleId(id)}
                />
              </div>
            )}

            {/* Article grid */}
            {restArticles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {restArticles.map((article: any) => (
                  <NewsCard
                    key={article.id}
                    article={article as NewsArticle}
                    onRead={(id) => setSelectedArticleId(id)}
                  />
                ))}
              </div>
            )}

            {/* Generation info */}
            {isGenerating && (
              <div className="cacti-card p-6 mt-6 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  Cacti is analyzing intelligence data and writing news articles...
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {generateAllMutation.isPending
                    ? "Generating articles for all 4 cities. This may take 2-3 minutes."
                    : "This may take 30-60 seconds as the AI processes documents for each city."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </CactiLayout>
  );
}
