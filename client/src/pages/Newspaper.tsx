import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CactiLayout from "@/components/CactiLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  RefreshCw,
  Zap,
  BookOpen,
  ExternalLink,
  ChevronRight,
  Newspaper as NewspaperIcon,
  AlertTriangle,
  Shield,
  Landmark,
  TreePine,
  GraduationCap,
  TrendingUp,
  Users,
  Heart,
  Wrench,
} from "lucide-react";
import { CactiLogo, CactiMasthead } from "@/components/CactiLogo";
import {
  MOHAVE_CITIES,
  ARIZONA_WIRE_CITIES,
  CITIES as REGION_CITIES,
  CITY_TAGLINES,
} from "../../../shared/region.js";
import { isStillBreaking } from "@/lib/news";

const CITIES = [...REGION_CITIES];
const CITY_MOTTOS = CITY_TAGLINES;
const WIRE_SET = new Set(ARIZONA_WIRE_CITIES);

const CITY_CLASS: Record<string, string> = {
  Kingman: "cacti-city-kingman",
  "Bullhead City": "cacti-city-bullhead",
  "Lake Havasu City": "cacti-city-havasu",
  "Mohave County": "cacti-city-mohave",
  // Arizona Wire editions fall back to the default cacti-newspaper theme —
  // no per-city CSS variables. They're visually subordinate to Mohave.
};

const CITY_ACCENT: Record<string, string> = {
  // Mohave primary editions — full-saturation Cacti palette
  Kingman: "oklch(0.78 0.15 195)",
  "Bullhead City": "oklch(0.72 0.18 155)",
  "Lake Havasu City": "oklch(0.78 0.16 75)",
  "Mohave County": "oklch(0.65 0.18 300)",
  // Arizona Wire secondary editions — muted, slate-leaning so they
  // visually recede behind the primary Mohave tabs
  "Phoenix Metro": "oklch(0.68 0.08 50)",
  "Flagstaff Area": "oklch(0.68 0.08 200)",
  "Tucson Metro": "oklch(0.68 0.08 280)",
  "Other Arizona": "oklch(0.65 0.04 240)",
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

const CATEGORY_ICONS: Record<string, typeof Landmark> = {
  government: Landmark,
  public_safety: Shield,
  infrastructure: Wrench,
  environment: TreePine,
  education: GraduationCap,
  economy: TrendingUp,
  community: Users,
  health: Heart,
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

function ImportanceDots({ importance }: { importance: number }) {
  const dots = Math.min(10, Math.max(1, importance));
  return (
    <div className="cacti-importance">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`cacti-importance-dot ${i >= dots ? "inactive" : ""}`} />
      ))}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] || Users;
  return (
    <span className={`cacti-cat-${category} inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <Icon className="h-3 w-3" />
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function formatStaleness(publishedAt: Date | null): { label: string; tone: "fresh" | "warm" | "stale" } | null {
  if (!publishedAt) return null;
  const hours = (Date.now() - publishedAt.getTime()) / 3_600_000;
  if (hours < 24) {
    return {
      label: `Published today, ${publishedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })}`,
      tone: "fresh",
    };
  }
  const days = Math.floor(hours / 24);
  const label = days === 1 ? "Published yesterday" : `Published ${days} days ago`;
  return { label, tone: days <= 2 ? "warm" : "stale" };
}

function NewspaperMasthead({
  city,
  edition,
  lastPublishedAt,
}: {
  city: string;
  edition: string;
  lastPublishedAt: Date | null;
}) {
  const today = new Date();
  // Use Phoenix time for all masthead dates — Mohave County is in MST (no
  // DST), so a Mohave resident reading the paper at 11pm local on May 18
  // should see "May 18" not "May 19 (UTC)". Same TZ as the Daily Brief.
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Phoenix",
  });
  const accent = CITY_ACCENT[city] || CITY_ACCENT.Kingman;
  const staleness = formatStaleness(lastPublishedAt);
  const staleColor =
    staleness?.tone === "fresh"
      ? "oklch(0.72 0.18 155)"
      : staleness?.tone === "warm"
        ? "oklch(0.78 0.16 75)"
        : "oklch(0.65 0.22 25)";

  return (
    <div className="cacti-masthead py-5 px-4 mb-6 rounded-lg">
      {/* Top rule line */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3 px-2" style={{ fontFamily: "var(--font-mono)" }}>
        <span style={{ color: accent }}>VOL. I • EDITION {edition}</span>
        <span>✦ SOURCE-CONNECTED LOCAL EDITION ✦</span>
        <span style={{ color: accent }}>EST. 2026</span>
      </div>

      {/* Ornamental line */}
      <div className="cacti-ornament">
        <span className="text-[10px]" style={{ color: accent }}>◆</span>
      </div>

      {/* Masthead */}
      <CactiMasthead className="my-3" />

      {/* City subtitle. Wire editions get a small editorial label above the
          city name so the reader knows this is the "Across Arizona" wire
          section, not Mohave-primary coverage. */}
      <div className="text-center mt-3">
        {WIRE_SET.has(city) && (
          <div
            className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70 mb-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ◇ Across Arizona Wire ◇
          </div>
        )}
        <div
          className="text-xl font-semibold tracking-wide"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: accent }}
        >
          {city} Edition
        </div>
        <div className="text-xs text-muted-foreground italic mt-0.5">{CITY_MOTTOS[city] || ""}</div>
      </div>

      {/* Ornamental line */}
      <div className="cacti-ornament mt-3">
        <span className="text-[10px]" style={{ color: accent }}>◆</span>
      </div>

      {/* Bottom info line */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 px-2" style={{ fontFamily: "var(--font-mono)" }}>
        <span>{dateStr}</span>
        <span style={{ color: accent }}>MOHAVE COUNTY, ARIZONA</span>
        {staleness ? (
          <span style={{ color: staleColor }} className="uppercase tracking-wider">
            {staleness.label}
          </span>
        ) : (
          <span>FOLLOW THE SOURCE RECORD</span>
        )}
      </div>
    </div>
  );
}

function BreakingBanner({ article, onReadMore }: { article: any; onReadMore: (id: number) => void }) {
  return (
    <div
      className="cacti-breaking-banner rounded-lg p-4 mb-6 cursor-pointer hover:border-cacti-red/70 transition-colors"
      onClick={() => onReadMore(article.id)}
    >
      <div className="flex items-start gap-3">
        <div className="bg-cacti-red/20 rounded-full p-2 mt-0.5 shrink-0">
          <AlertTriangle className="h-5 w-5 text-cacti-red" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-cacti-red uppercase tracking-widest animate-pulse" style={{ fontFamily: "var(--font-mono)" }}>
              ⚡ BREAKING NEWS
            </span>
            <ImportanceDots importance={article.importance} />
          </div>
          <h2
            className="text-xl md:text-2xl font-black leading-tight text-foreground mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {article.headline}
          </h2>
          <p className="text-sm text-foreground/70 leading-relaxed">{article.summary}</p>
          <div className="flex items-center gap-3 mt-3">
            <CategoryBadge category={article.category} />
            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {parseCitations(article.citations).length} cited sources
            </span>
            <span className="text-[10px] text-cacti-red hover:underline ml-auto flex items-center gap-1">
              Full story <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadStory({
  article,
  onReadMore,
  accent,
}: {
  article: any;
  onReadMore: (id: number) => void;
  accent: string;
}) {
  const citations = parseCitations(article.citations);

  return (
    <div className="cacti-lead-story mb-6 pb-6" style={{ borderLeftColor: accent }}>
      <div className="flex items-center gap-2 mb-3">
        <CategoryBadge category={article.category} />
        <ImportanceDots importance={article.importance} />
      </div>

      <h2
        className="text-3xl md:text-4xl font-black leading-tight mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        onClick={() => onReadMore(article.id)}
      >
        {article.headline}
      </h2>

      <p
        className="text-lg leading-relaxed mb-4 italic"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: accent }}
      >
        {article.summary}
      </p>

      {/* Article body - first few paragraphs */}
      <div className="newspaper-columns">
        {article.body
          .split("\n")
          .filter((p: string) => p.trim() && !p.startsWith("#"))
          .slice(0, 4)
          .map((paragraph: string, i: number) => (
            <p key={i} className="text-sm leading-relaxed mb-3 text-foreground/85">
              {i === 0 && (
                <span
                  className="text-4xl font-bold float-left mr-2 mt-0.5 leading-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: accent }}
                >
                  {paragraph.charAt(0)}
                </span>
              )}
              {i === 0 ? paragraph.slice(1) : paragraph}
            </p>
          ))}
      </div>

      {/* Why it matters */}
      {article.whyItMatters && (
        <div className="cacti-analysis-box pl-4 pr-4 py-3 my-4">
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ fontFamily: "var(--font-mono)", color: accent }}>
            ◆ Analysis — Why This Matters
          </span>
          <p className="text-sm text-foreground/80 italic leading-relaxed">{article.whyItMatters}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          <BookOpen className="h-3 w-3" style={{ color: accent }} />
          {citations.length} cited source{citations.length !== 1 ? "s" : ""}
        </div>
        <button
          className="text-xs hover:underline flex items-center gap-1 font-semibold"
          style={{ color: accent }}
          onClick={() => onReadMore(article.id)}
        >
          Continue reading <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ColumnStory({
  article,
  onReadMore,
  accent,
}: {
  article: any;
  onReadMore: (id: number) => void;
  accent: string;
}) {
  const citations = parseCitations(article.citations);
  const firstParagraph = article.body
    .split("\n")
    .filter((p: string) => p.trim() && !p.startsWith("#"))[0] || "";

  return (
    <div className="cacti-column-divider">
      <div className="flex items-center gap-2 mb-2">
        <CategoryBadge category={article.category} />
        <ImportanceDots importance={article.importance} />
      </div>
      <h3
        className="text-lg font-bold leading-snug mb-2 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        onClick={() => onReadMore(article.id)}
      >
        {article.headline}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-4">
        {firstParagraph}
      </p>
      {article.whyItMatters && (
        <p className="text-xs italic mb-2" style={{ color: accent }}>
          ◆ {article.whyItMatters}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          {citations.length} source{citations.length !== 1 ? "s" : ""}
        </span>
        <button
          className="text-[10px] hover:underline font-semibold"
          style={{ color: accent }}
          onClick={() => onReadMore(article.id)}
        >
          Read more →
        </button>
      </div>
    </div>
  );
}

function BriefItem({ article, onReadMore, accent }: { article: any; onReadMore: (id: number) => void; accent: string }) {
  return (
    <div
      className="py-2.5 border-b border-foreground/5 last:border-b-0 cursor-pointer hover:bg-foreground/5 px-3 -mx-3 rounded transition-colors flex items-start gap-2"
      onClick={() => onReadMore(article.id)}
    >
      <span className="text-xs mt-0.5" style={{ color: accent }}>◆</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <CategoryBadge category={article.category} />
        </div>
        <div className="text-sm font-semibold leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {article.headline}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.summary}</p>
      </div>
    </div>
  );
}

function ArticleDetailView({
  article,
  onBack,
  accent,
}: {
  article: any;
  onBack: () => void;
  accent: string;
}) {
  const [, navigate] = useLocation();
  const citations = parseCitations(article.citations);

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Edition
      </Button>

      {isStillBreaking(article) ? (
        <div className="cacti-breaking-banner rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cacti-red" />
            <span className="text-[10px] font-black text-cacti-red uppercase tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>
              ⚡ Breaking News Alert
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 mb-3">
        <CategoryBadge category={article.category} />
        <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          {article.city} • {article.edition}
        </span>
        <ImportanceDots importance={article.importance} />
      </div>

      <h1
        className="text-3xl md:text-4xl font-black leading-tight mb-4"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {article.headline}
      </h1>

      <p
        className="text-lg mb-6 italic border-l-3 pl-4"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: accent, borderColor: accent }}
      >
        {article.summary}
      </p>

      <div className="cacti-ornament mb-6">
        <span className="text-[10px]" style={{ color: accent }}>◆</span>
      </div>

      <div className="newspaper-body">
        {article.body.split("\n").map((paragraph: string, i: number) => {
          if (paragraph.startsWith("## ")) {
            return (
              <h2
                key={i}
                className="text-xl font-bold mt-6 mb-3"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: accent }}
              >
                {paragraph.replace("## ", "")}
              </h2>
            );
          }
          if (paragraph.startsWith("### ")) {
            return (
              <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
                {paragraph.replace("### ", "")}
              </h3>
            );
          }
          if (paragraph.trim() === "") return null;
          return (
            <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-3">
              {paragraph}
            </p>
          );
        })}
      </div>

      {article.whyItMatters && (
        <div className="cacti-analysis-box p-4 my-6 rounded-r-lg">
          <span className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ fontFamily: "var(--font-mono)", color: accent }}>
            ◆ Why This Matters
          </span>
          <p className="text-foreground/80 leading-relaxed">{article.whyItMatters}</p>
        </div>
      )}

      {citations.length > 0 && (
        <div className="cacti-sources-box p-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4" style={{ color: accent }} />
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: accent }}>
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
                <span className="font-mono text-xs mt-0.5" style={{ color: accent }}>[{i + 1}]</span>
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

export default function Newspaper() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedCity, setSelectedCity] = useState("Kingman");
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  // Fetch articles for selected city
  const { data: cityArticles, isLoading: cityLoading, refetch: refetchCity } = trpc.news.list.useQuery({
    limit: 50,
    city: selectedCity,
  });

  // (was previously fetching ALL articles for breaking-news mode; switched to
  // city-scoped so breaking alerts respect the city tab the user picked)
  const allArticles = cityArticles;

  const generateMutation = trpc.news.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.articleCount} articles for edition ${data.edition}`);
      refetchCity();
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
      refetchCity();
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const isGenerating = generateMutation.isPending || generateAllMutation.isPending;

  const handlePrint = () => {
    window.print();
  };

  // Breaking alerts for the currently-selected city only.
  const breakingAlerts = useMemo(() => {
    if (!cityArticles) return [];
    return cityArticles.filter((a: any) => isStillBreaking(a));
  }, [cityArticles]);

  // Sorted articles for the selected city
  const sortedArticles = useMemo(() => {
    if (!cityArticles) return [];
    return [...cityArticles].sort((a: any, b: any) => {
      const aBreak = isStillBreaking(a);
      const bBreak = isStillBreaking(b);
      if (aBreak && !bBreak) return -1;
      if (!aBreak && bBreak) return 1;
      return (b.importance || 5) - (a.importance || 5);
    });
  }, [cityArticles]);

  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    // Search in both city and all articles
    const fromCity = cityArticles?.find((a: any) => a.id === selectedArticleId);
    if (fromCity) return fromCity;
    return allArticles?.find((a: any) => a.id === selectedArticleId) || null;
  }, [selectedArticleId, cityArticles, allArticles]);

  // Separate breaking from non-breaking for layout
  const nonBreakingArticles = sortedArticles.filter((a: any) => !isStillBreaking(a));
  const leadStory = nonBreakingArticles[0];
  const columnStories = nonBreakingArticles.slice(1, 4);
  const briefStories = nonBreakingArticles.slice(4);
  const edition = sortedArticles[0]?.edition || new Date().toISOString().split("T")[0];
  const accent = CITY_ACCENT[selectedCity] || CITY_ACCENT.Kingman;

  // Most-recent createdAt across all articles in this city's edition — drives
  // the "Last published N days ago" indicator in the masthead so anon
  // visitors can see at a glance whether the edition is fresh.
  const lastPublishedAt = useMemo(() => {
    if (!cityArticles || cityArticles.length === 0) return null;
    let latest = 0;
    for (const a of cityArticles) {
      const t = new Date((a as any).createdAt).getTime();
      if (t > latest) latest = t;
    }
    return latest > 0 ? new Date(latest) : null;
  }, [cityArticles]);

  return (
    <CactiLayout>
      <div className={`cacti-newspaper p-4 md:p-6 max-w-5xl mx-auto ${CITY_CLASS[selectedCity] || ""}`}>
        {selectedArticle ? (
          <ArticleDetailView
            article={selectedArticle}
            onBack={() => setSelectedArticleId(null)}
            accent={accent}
          />
        ) : (
          <>
            {/* Back to News Feed */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/news")} className="text-muted-foreground hover:text-foreground self-start">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to News Feed
              </Button>
              {user && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => generateAllMutation.mutate()}
                    disabled={isGenerating}
                    className="border"
                    style={{ borderColor: "oklch(0.7 0.15 155 / 0.5)", color: "oklch(0.7 0.15 155)", background: "oklch(0.7 0.15 155 / 0.15)" }}
                  >
                    {generateAllMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    {generateAllMutation.isPending ? "All Cities..." : "Generate All Cities"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => generateMutation.mutate({ city: selectedCity })}
                    disabled={isGenerating}
                    className="border"
                    style={{
                      borderColor: accent.replace(")", " / 0.5)"),
                      color: accent,
                      background: accent.replace(")", " / 0.15)"),
                    }}
                  >
                    {generateMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    {generateMutation.isPending ? "Generating..." : `Generate ${selectedCity}`}
                  </Button>
                  {sortedArticles.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePrint}
                      className="border-foreground/20 text-foreground/70 hover:text-foreground"
                    >
                      <NewspaperIcon className="h-4 w-4 mr-1" />
                      Print Edition
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* City edition tabs — Mohave primary row + Across Arizona wire row.
                Two rows visually communicates the editorial hierarchy: this
                is Mohave's paper first, with a state wire section second. */}
            <div className="space-y-2 mb-4" data-tour="city-tabs">
              <div className="flex items-center gap-1 cacti-scroll-x pb-1">
                {MOHAVE_CITIES.map((city) => {
                  const cityAccent = CITY_ACCENT[city];
                  const isActive = selectedCity === city;
                  return (
                    <Button
                      key={city}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCity(city);
                        setSelectedArticleId(null);
                      }}
                      className="rounded-none border-b-2 transition-all"
                      style={{
                        borderColor: isActive ? cityAccent : "transparent",
                        color: isActive ? cityAccent : undefined,
                        fontWeight: isActive ? 700 : 400,
                      }}
                    >
                      {city}
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 cacti-scroll-x pb-1 pt-1 border-t border-border/30">
                <span
                  className="text-[10px] tracking-widest uppercase text-muted-foreground/70 shrink-0 pr-1"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  ◇ Across Arizona
                </span>
                {ARIZONA_WIRE_CITIES.map((city) => {
                  const cityAccent = CITY_ACCENT[city];
                  const isActive = selectedCity === city;
                  return (
                    <Button
                      key={city}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCity(city);
                        setSelectedArticleId(null);
                      }}
                      className="rounded-none border-b-2 transition-all text-xs"
                      style={{
                        borderColor: isActive ? cityAccent : "transparent",
                        color: isActive ? cityAccent : "var(--color-muted-foreground)",
                        fontWeight: isActive ? 600 : 400,
                        opacity: isActive ? 1 : 0.75,
                      }}
                    >
                      {city}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Newspaper masthead */}
            <NewspaperMasthead city={selectedCity} edition={edition} lastPublishedAt={lastPublishedAt} />

            {/* BREAKING ALERTS — city-scoped */}
            {breakingAlerts.length > 0 && (
              <div className="mb-6">
                {breakingAlerts.map((alert: any) => (
                  <BreakingBanner
                    key={alert.id}
                    article={alert}
                    onReadMore={(id) => setSelectedArticleId(id)}
                  />
                ))}
              </div>
            )}

            {/* Loading state */}
            {cityLoading && (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full rounded" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-48 rounded" />
                  <Skeleton className="h-48 rounded" />
                </div>
              </div>
            )}

            {/* Empty state */}
            {!cityLoading && sortedArticles.length === 0 && breakingAlerts.length === 0 && (
              <div className="text-center py-16">
                <NewspaperIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  No articles for {selectedCity} yet
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  This edition will appear after the owner reviews and publishes generated stories.
                </p>
                {user && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => generateAllMutation.mutate()}
                      disabled={isGenerating}
                      className="border"
                      style={{ borderColor: "oklch(0.7 0.15 155 / 0.5)", color: "oklch(0.7 0.15 155)", background: "oklch(0.7 0.15 155 / 0.15)" }}
                    >
                      {generateAllMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      {generateAllMutation.isPending ? "Generating All..." : "Generate All Cities"}
                    </Button>
                    <Button
                      onClick={() => generateMutation.mutate({ city: selectedCity })}
                      disabled={isGenerating}
                      className="border"
                      style={{
                      borderColor: accent.replace(")", " / 0.5)"),
                      color: accent,
                      background: accent.replace(")", " / 0.15)"),
                    }}
                    >
                      {generateMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-1" />
                      )}
                      Generate {selectedCity} Edition
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Newspaper layout */}
            {(nonBreakingArticles.length > 0) && (
              <>
                {/* Section divider */}
                <div className="cacti-section-header">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-mono)", color: accent }}>
                    ◆ Top Stories
                  </span>
                </div>

                {/* Lead story - full width */}
                {leadStory && (
                  <LeadStory
                    article={leadStory}
                    onReadMore={(id) => setSelectedArticleId(id)}
                    accent={accent}
                  />
                )}

                {/* Ornamental divider */}
                {columnStories.length > 0 && (
                  <div className="cacti-ornament my-4">
                    <span className="text-[10px]" style={{ color: accent }}>◆</span>
                  </div>
                )}

                {/* Two-column layout for secondary stories */}
                {columnStories.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="md:border-r md:pr-6" style={{ borderColor: `${accent}20` }}>
                      {columnStories.filter((_: any, i: number) => i % 2 === 0).map((article: any) => (
                        <ColumnStory
                          key={article.id}
                          article={article}
                          onReadMore={(id) => setSelectedArticleId(id)}
                          accent={accent}
                        />
                      ))}
                    </div>
                    <div>
                      {columnStories.filter((_: any, i: number) => i % 2 === 1).map((article: any) => (
                        <ColumnStory
                          key={article.id}
                          article={article}
                          onReadMore={(id) => setSelectedArticleId(id)}
                          accent={accent}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Briefs section */}
                {briefStories.length > 0 && (
                  <>
                    <div className="cacti-section-header mt-6">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-mono)", color: accent }}>
                        ◆ In Brief
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      {briefStories.map((article: any) => (
                        <BriefItem
                          key={article.id}
                          article={article}
                          onReadMore={(id) => setSelectedArticleId(id)}
                          accent={accent}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Footer */}
                <div className="cacti-footer mt-8 pt-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <CactiLogo size={28} />
                    <span
                      className="text-lg font-black tracking-tight"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      THE CACTI
                    </span>
                    <CactiLogo size={28} className="scale-x-[-1]" />
                  </div>
                  <p className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    All articles are AI-generated from verified civic documents with 100% source citations.
                  </p>
                  <p className="text-[10px] mt-1" style={{ fontFamily: "var(--font-mono)", color: `${accent}80` }}>
                    The Cacti • Mohave County, Arizona
                  </p>
                </div>
              </>
            )}

            {/* Generation loading */}
            {isGenerating && (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin" style={{ color: accent }} />
                <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  {generateAllMutation.isPending
                    ? "Writing editions for all 4 cities... This may take 2-3 minutes."
                    : `Writing ${selectedCity} edition...`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </CactiLayout>
  );
}
