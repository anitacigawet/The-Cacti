import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Download,
  Loader2,
  Brain,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Calendar,
  CalendarDays,
  Trash2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#06b6d4",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

type ViewMode = "overview" | "report";

export default function Reports() {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [activeReportContent, setActiveReportContent] = useState<string | null>(null);
  const [activeReportTitle, setActiveReportTitle] = useState<string>("");
  const [reportToDelete, setReportToDelete] = useState<{ id: number; title: string } | null>(null);
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const dailyBrief = trpc.intelligence.dailyBrief.useQuery();
  const metrics = trpc.analytics.metrics.useQuery();
  const sentiment = trpc.analytics.sentimentDistribution.useQuery();
  const alerts = trpc.intelligence.alerts.useQuery({ status: "active", limit: 10 });
  const topics = trpc.analytics.topTopics.useQuery({ limit: 10 });
  const reportHistory = trpc.reports.list.useQuery({ limit: 20, type: "all" });

  const generateDaily = trpc.reports.generateDaily.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setActiveReportContent(data.content!);
        setActiveReportTitle(data.title!);
        setViewMode("report");
        utils.reports.list.invalidate();
        toast.success("Daily intelligence brief generated");
      } else {
        toast.error(data.message || "Failed to generate report");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const generateWeekly = trpc.reports.generateWeekly.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setActiveReportContent(data.content!);
        setActiveReportTitle(data.title!);
        setViewMode("report");
        utils.reports.list.invalidate();
        toast.success("Weekly intelligence report generated");
      } else {
        toast.error(data.message || "Failed to generate report");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteReport = trpc.reports.delete.useMutation({
    onSuccess: () => {
      utils.reports.list.invalidate();
      toast.success("Report deleted");
    },
  });

  const loadReport = (report: { title: string; content: string }) => {
    setActiveReportContent(report.content);
    setActiveReportTitle(report.title);
    setViewMode("report");
  };

  const handleExportCSV = () => {
    if (!dailyBrief.data?.items) return;
    const headers = ["Title", "City", "Sentiment", "Impact Level", "Summary"];
    const rows = dailyBrief.data.items.map((item) => [
      `"${item.title.replace(/"/g, '""')}"`,
      item.city,
      item.sentiment,
      item.impactLevel,
      `"${(item.summary || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacti-intelligence-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleExportReportMarkdown = () => {
    if (!activeReportContent) return;
    const blob = new Blob([`# ${activeReportTitle}\n\n${activeReportContent}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReportTitle.replace(/[^a-zA-Z0-9-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported as Markdown");
  };

  const sentimentSummary = useMemo(() => {
    if (!sentiment.data) return null;
    const total = Object.values(sentiment.data).reduce((a, b) => a + (b as number), 0);
    if (total === 0) return null;
    const dominant = Object.entries(sentiment.data).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0];
    return {
      dominant: dominant[0],
      percentage: Math.round(((dominant[1] as number) / total) * 100),
      total,
    };
  }, [sentiment.data]);

  const isGenerating = generateDaily.isPending || generateWeekly.isPending;

  if (viewMode === "report" && activeReportContent) {
    return (
      <CactiLayout>
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("overview")}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReportMarkdown}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export Markdown
            </Button>
          </div>

          {/* Report content */}
          <Card className="bg-card border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span
                  className="tracking-wider text-primary uppercase"
                  style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
                >
                  {activeReportTitle}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="cacti-report">
                <Streamdown>{activeReportContent}</Streamdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </CactiLayout>
    );
  }

  return (
    <CactiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              INTELLIGENCE REPORTS
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated intelligence briefs with executive summaries and threat assessments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!dailyBrief.data?.items?.length}
              className="border-border text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="cacti-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-cacti-cyan" />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Total Documents
              </span>
            </div>
            <p className="text-2xl text-cacti-cyan" style={{ fontFamily: "var(--font-display)" }}>
              {metrics.data?.totalDocuments ?? "—"}
            </p>
          </div>
          <div className="cacti-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-cacti-green" />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                AI Analyzed
              </span>
            </div>
            <p className="text-2xl text-cacti-green" style={{ fontFamily: "var(--font-display)" }}>
              {metrics.data?.analyzedDocuments ?? "—"}
            </p>
          </div>
          <div className="cacti-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-cacti-amber" />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Dominant Sentiment
              </span>
            </div>
            <p className="text-lg capitalize" style={{
              fontFamily: "var(--font-display)",
              color: sentimentSummary ? SENTIMENT_COLORS[sentimentSummary.dominant] : undefined,
            }}>
              {sentimentSummary ? `${sentimentSummary.dominant} (${sentimentSummary.percentage}%)` : "—"}
            </p>
          </div>
          <div className="cacti-card p-4 space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-cacti-red" />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Active Alerts
              </span>
            </div>
            <p className="text-2xl text-cacti-red" style={{ fontFamily: "var(--font-display)" }}>
              {alerts.data?.length ?? "—"}
            </p>
          </div>
        </div>

        {/* Generate Reports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="reports-generate">
          <Card className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3
                    className="text-sm tracking-wider text-primary uppercase mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Daily Intelligence Brief
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Comprehensive daily report with executive summary, threat assessment, city-by-city analysis, and recommendations.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => generateDaily.mutate()}
                    disabled={isGenerating || !user}
                    className="cacti-glow gap-1.5"
                  >
                    {generateDaily.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate Daily Brief
                  </Button>
                  {!user && (
                    <p className="text-[10px] text-muted-foreground mt-1">Sign in to generate reports</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <CalendarDays className="h-6 w-6 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3
                    className="text-sm tracking-wider text-amber-400 uppercase mb-1"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Weekly Comprehensive Report
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    In-depth weekly analysis with statistical overview, threat matrix, source reliability assessment, and strategic outlook.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateWeekly.mutate()}
                    disabled={isGenerating || !user}
                    className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    {generateWeekly.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate Weekly Report
                  </Button>
                  {!user && (
                    <p className="text-[10px] text-muted-foreground mt-1">Sign in to generate reports</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generating indicator */}
        {isGenerating && (
          <Card className="bg-card border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <div>
                  <p className="text-sm text-foreground">Generating intelligence report...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Analyzing {metrics.data?.analyzedDocuments || 0} documents across {metrics.data?.totalCities || 0} cities using AI
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report History */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span
                  className="tracking-wider text-primary uppercase"
                  style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
                >
                  Report History
                </span>
                {reportHistory.data && (
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {reportHistory.data.length === 1
                      ? "1 report"
                      : `${reportHistory.data.length} reports`}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reportHistory.refetch()}
                className="text-muted-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reportHistory.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reportHistory.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : !reportHistory.data || reportHistory.data.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
                <p className="text-muted-foreground">No reports generated yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Generate a daily or weekly report to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {reportHistory.data.map((report) => {
                  const metadata = report.metadata as any;
                  return (
                    <div
                      key={report.id}
                      className="group flex items-center gap-3 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 border border-transparent hover:border-primary/20 transition-colors cursor-pointer"
                      onClick={() => loadReport(report)}
                    >
                      <div className={`p-2 rounded-lg ${report.type === "weekly" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                        {report.type === "weekly" ? (
                          <CalendarDays className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Calendar className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">
                          {report.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              report.type === "weekly" ? "border-amber-500/30 text-amber-400" : ""
                            }`}
                          >
                            {report.type}
                          </Badge>
                          {metadata?.documentCount && (
                            <span className="text-[10px] text-muted-foreground">
                              {metadata.documentCount} docs analyzed
                            </span>
                          )}
                          {report.tokensUsed ? (
                            <span className="text-[10px] text-muted-foreground">
                              {report.tokensUsed} tokens
                            </span>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportToDelete({ id: report.id, title: report.title });
                          }}
                          title="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete report confirmation */}
        <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle
                className="tracking-wider text-primary uppercase"
                style={{ fontFamily: "var(--font-display)", fontSize: "14px" }}
              >
                Delete this report?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete{" "}
                <span className="text-foreground font-medium">{reportToDelete?.title}</span>?
                This can&apos;t be undone — you&apos;ll need to regenerate it (which will use LLM tokens).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (reportToDelete) {
                    deleteReport.mutate({ id: reportToDelete.id });
                    setReportToDelete(null);
                  }
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete report
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Trending Topics */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle
              className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Trending Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topics.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(topics.data || []).map((topic, i) => {
                  const maxCount = topics.data?.[0]?.count || 1;
                  const pct = (topic.count / maxCount) * 100;
                  return (
                    <div key={topic.topic} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-foreground">{topic.topic}</span>
                          <span className="text-[10px] text-muted-foreground">{topic.count}</span>
                        </div>
                        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CactiLayout>
  );
}
