import CactiLayout from "@/components/CactiLayout";
import { NoDataBanner } from "@/components/EmptyStateBanners";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SentimentTag } from "@/components/MetaTag";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Brain,
  Activity,
  Database,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Bell,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#06b6d4",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

const IMPACT_COLORS: Record<string, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#22c55e",
};

function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = "text-primary",
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`cacti-card p-4 space-y-2 ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs tracking-wider text-muted-foreground uppercase"
          style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
        >
          {title}
        </span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-2xl md:text-3xl font-bold ${color}`} style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="cacti-card p-3 text-xs space-y-1" style={{ fontFamily: "var(--font-mono)" }}>
      <p className="text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const metrics = trpc.analytics.metrics.useQuery();
  const sentiment = trpc.analytics.sentimentDistribution.useQuery();
  const impact = trpc.analytics.impactDistribution.useQuery();
  const sources = trpc.analytics.sourceBreakdown.useQuery();
  const timeline = trpc.analytics.timeline.useQuery();
  const topics = trpc.analytics.topTopics.useQuery({ limit: 10 });
  const recentIntel = trpc.analytics.recentIntelligence.useQuery({ limit: 6 });
  const alertStats = trpc.alertRules.stats.useQuery();

  // SSE real-time auto-refresh
  const { lastEvent, eventCount } = useSSE();
  const lastRefreshEvent = useRef(0);

  useEffect(() => {
    if (eventCount > lastRefreshEvent.current) {
      lastRefreshEvent.current = eventCount;
      // Invalidate all dashboard queries on new SSE events
      utils.analytics.metrics.invalidate();
      utils.analytics.sentimentDistribution.invalidate();
      utils.analytics.impactDistribution.invalidate();
      utils.analytics.sourceBreakdown.invalidate();
      utils.analytics.timeline.invalidate();
      utils.analytics.topTopics.invalidate();
      utils.analytics.recentIntelligence.invalidate();
      utils.alertRules.stats.invalidate();
    }
  }, [eventCount, utils]);

  const sentimentData = sentiment.data
    ? Object.entries(sentiment.data)
        .filter(([, value]) => (value as number) > 0)
        .map(([name, value]) => ({ name, value: value as number }))
    : [];

  const impactData = impact.data
    ? Object.entries(impact.data)
        .filter(([, value]) => (value as number) > 0)
        .map(([name, value]) => ({ name, value: value as number }))
    : [];

  const activeAlerts = alertStats.data?.active ?? 0;

  return (
    <CactiLayout>
      <div className="space-y-6">
        <NoDataBanner totalDocuments={metrics.data?.totalDocuments ?? 0} />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              DASHBOARD
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Mohave County Civic Intelligence Overview
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Alert badge */}
            {activeAlerts > 0 && (
              <button
                onClick={() => setLocation("/alerts")}
                className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cacti-red/10 border border-cacti-red/30 hover:bg-cacti-red/20 transition-all"
              >
                <Bell className="h-4 w-4 text-cacti-red cacti-pulse" />
                <span className="text-xs text-cacti-red font-bold" style={{ fontFamily: "var(--font-mono)" }}>
                  {activeAlerts}
                </span>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cacti-red rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cacti-red rounded-full" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-cacti-green cacti-pulse" />
              <span
                className="text-xs text-cacti-green tracking-wider"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Metric Cards - clickable for drill-down */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-tour="dashboard-metrics">
          {metrics.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))
          ) : (
            <>
              <MetricCard
                title="Documents"
                value={metrics.data?.totalDocuments ?? 0}
                icon={FileText}
                subtitle="Total collected"
                color="text-cacti-cyan"
                onClick={() => setLocation("/documents")}
              />
              <MetricCard
                title="Analyzed"
                value={metrics.data?.analyzedDocuments ?? 0}
                icon={Brain}
                subtitle="AI processed"
                color="text-cacti-green"
                onClick={() => setLocation("/documents")}
              />
              <MetricCard
                title="Coverage"
                value={`${metrics.data?.analysisCoverage ?? 0}%`}
                icon={Activity}
                subtitle="Analysis rate"
                color="text-cacti-amber"
                onClick={() => setLocation("/reports")}
              />
              <MetricCard
                title="Sources"
                value={metrics.data?.totalSources ?? 0}
                icon={Database}
                subtitle="Data feeds"
                color="text-cacti-purple"
                onClick={() => setLocation("/settings")}
              />
              <MetricCard
                title="Cities"
                value={metrics.data?.totalCities ?? 0}
                icon={TrendingUp}
                subtitle="Monitored"
                color="text-primary"
                onClick={() => setLocation("/map")}
              />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sentiment Distribution - clickable bars */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                Sentiment Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sentiment.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-4 pt-2">
                  {sentimentData.map((s) => {
                    const total = sentimentData.reduce((a, b) => a + b.value, 0);
                    const pct = total > 0 ? (s.value / total) * 100 : 0;
                    return (
                      <div
                        key={s.name}
                        className="space-y-1.5 cursor-pointer group"
                        onClick={() => setLocation(`/documents?sentiment=${s.name}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full group-hover:scale-125 transition-transform" style={{ backgroundColor: SENTIMENT_COLORS[s.name] }} />
                            <span className="text-sm capitalize text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-mono)" }}>{s.name}</span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: SENTIMENT_COLORS[s.name], fontFamily: "var(--font-display)" }}>
                            {s.value} <span className="text-xs font-normal text-muted-foreground">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                            style={{ width: `${pct}%`, backgroundColor: SENTIMENT_COLORS[s.name], boxShadow: `0 0 8px ${SENTIMENT_COLORS[s.name]}60` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impact Distribution - clickable bars */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                Impact Levels
              </CardTitle>
            </CardHeader>
            <CardContent>
              {impact.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-4 pt-2">
                  {impactData.map((d) => {
                    const total = impactData.reduce((a, b) => a + b.value, 0);
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (
                      <div
                        key={d.name}
                        className="space-y-1.5 cursor-pointer group"
                        onClick={() => setLocation(`/documents?search=${d.name}+impact`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded group-hover:scale-125 transition-transform" style={{ backgroundColor: IMPACT_COLORS[d.name] }} />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-mono)" }}>{d.name}</span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: IMPACT_COLORS[d.name], fontFamily: "var(--font-display)" }}>
                            {d.value} <span className="text-xs font-normal text-muted-foreground">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                            style={{ width: `${pct}%`, backgroundColor: IMPACT_COLORS[d.name], boxShadow: `0 0 8px ${IMPACT_COLORS[d.name]}60` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Source Breakdown - clickable bars */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                Source Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sources.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-2.5 pt-1">
                  {(sources.data || []).slice(0, 8).map((s, i) => {
                    const maxCount = sources.data?.[0]?.count || 1;
                    const pct = (s.count / maxCount) * 100;
                    const barColor = i === 0 ? "#06b6d4" : i < 3 ? "#22d3ee" : "#67e8f9";
                    return (
                      <div
                        key={s.source}
                        className="space-y-1 cursor-pointer group"
                        onClick={() => setLocation(`/documents?source=${encodeURIComponent(s.source)}`)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground truncate max-w-[180px] group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                            {s.source}
                          </span>
                          <span className="text-xs font-bold" style={{ color: barColor, fontFamily: "var(--font-display)" }}>
                            {s.count}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
                            style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}40` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle
              className="text-xs tracking-wider text-muted-foreground uppercase"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              Collection Timeline
            </CardTitle>
            <button
              onClick={() => setLocation("/timeline")}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Full timeline <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            {timeline.isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline.data || []}>
                  <defs>
                    <linearGradient id="gradientCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "oklch(0.60 0.04 195)", fontSize: 10 }}
                  />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#06b6d4"
                    fill="url(#gradientCyan)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bottom row: Topics + Intelligence Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Topics - clickable */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                Top Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topics.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-2">
                  {(topics.data || []).map((t, i) => (
                    <div
                      key={t.topic}
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => setLocation(`/documents?search=${encodeURIComponent(t.topic)}`)}
                    >
                      <span
                        className="text-xs text-muted-foreground w-4"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full rounded group-hover:brightness-125 transition-all"
                          style={{
                            width: `${Math.min(100, (t.count / (topics.data?.[0]?.count || 1)) * 100)}%`,
                            background: "linear-gradient(90deg, oklch(0.78 0.15 195 / 40%), oklch(0.72 0.18 155 / 40%))",
                          }}
                        />
                      </div>
                      <span className="text-xs text-foreground truncate max-w-[120px] group-hover:text-primary transition-colors">
                        {t.topic}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {t.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Intelligence */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                Intelligence Feed
              </CardTitle>
              <button
                onClick={() => setLocation("/intelligence")}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent>
              {recentIntel.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3">
                  {(recentIntel.data || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/documents/${item.id}`)}
                    >
                      <div className="mt-0.5">
                        {item.impactLevel === "High" ? (
                          <AlertTriangle className="h-4 w-4 text-cacti-red" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm text-foreground truncate font-medium">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.summary}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <SentimentTag value={item.sentiment} />
                          <span
                            className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/documents?city=${encodeURIComponent(item.city)}`);
                            }}
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {item.city}
                          </span>
                          {item.topics.map((t: string) => (
                            <span
                              key={t}
                              className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/documents?search=${encodeURIComponent(t)}`);
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CactiLayout>
  );
}
