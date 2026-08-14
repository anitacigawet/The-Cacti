import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Download,
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Zap,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Rss,
  Settings,
  BarChart3,
  Hexagon,
  Heart,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldOff,
  Mail,
  Send,
} from "lucide-react";

export default function IngestionPanel({ showHeader = true }: { showHeader?: boolean } = {}) {
  const { user: _user } = useAuth();
  void _user;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string[]>([]);

  // Queries
  const sources = trpc.ingestion.listSources.useQuery();
  const runs = trpc.ingestion.listRuns.useQuery({ limit: 10 });
  const stats = trpc.ingestion.stats.useQuery();
  const schedule = trpc.ingestion.getSchedule.useQuery();

  // Digest mutation
  const sendDigest = trpc.ingestion.sendDigest.useMutation({
    onSuccess: (data) => {
      stats.refetch();
      toast.success("Digest sent", { description: `${data.articleCount} articles across ${data.cities} cities` });
    },
    onError: (err) => toast.error("Digest failed", { description: err.message }),
  });

  // Mutations
  const addSource = trpc.ingestion.addSource.useMutation({
    onSuccess: () => {
      sources.refetch();
      stats.refetch();
      setAddDialogOpen(false);
      toast.success("Source added", { description: "New ingestion source configured" });
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const deleteSource = trpc.ingestion.deleteSource.useMutation({
    onSuccess: () => {
      sources.refetch();
      stats.refetch();
      toast.success("Source deleted");
    },
  });

  const runSource = trpc.ingestion.runSource.useMutation({
    onSuccess: (data) => {
      sources.refetch();
      runs.refetch();
      stats.refetch();
      toast.success("Ingestion complete", { description: `${data.documentsAnalyzed}/${data.documentsFound} documents ingested` });
    },
    onError: (err) => toast.error("Ingestion failed", { description: err.message }),
  });

  const runPipeline = trpc.ingestion.runPipeline.useMutation({
    onSuccess: (data) => {
      sources.refetch();
      runs.refetch();
      stats.refetch();
      toast.success("Pipeline complete", { description: `${data.totalDocumentsAnalyzed} docs from ${data.sourcesProcessed} sources` });
    },
    onError: (err) => toast.error("Pipeline failed", { description: err.message }),
  });

  const seedSources = trpc.ingestion.seedSources.useMutation({
    onSuccess: (data) => {
      sources.refetch();
      stats.refetch();
      toast.success("Sources seeded", { description: data.message });
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const updateSchedule = trpc.ingestion.updateSchedule.useMutation({
    onSuccess: () => {
      schedule.refetch();
      toast.success("Schedule updated");
    },
  });

  const updateSource = trpc.ingestion.updateSource.useMutation({
    onSuccess: () => {
      sources.refetch();
      toast.success("Source updated");
    },
  });

  // Add source form state
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    type: "webpage" as "rss" | "webpage" | "api" | "sitemap",
    city: "Kingman",
    category: "government",
    sourceLabel: "",
    intervalMinutes: 360,
  });

  const isPipelineRunning = runPipeline.isPending || runSource.isPending;

  return (
    <div className="space-y-6">
      {/* Header — hidden when embedded inside a parent surface (e.g. Settings tab) */}
      {showHeader ? (
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              INGESTION PIPELINE
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Autonomous document collection, analysis, and intelligence generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                sources.refetch();
                runs.refetch();
                stats.refetch();
              }}
              className="border-primary/30"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => runPipeline.mutate({ generateNews: true })}
              disabled={isPipelineRunning}
              className="bg-primary hover:bg-primary/90"
            >
              {isPipelineRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Full Pipeline
            </Button>
          </div>
        </div>
      ) : (
        // Embedded mode — show just the action buttons inline, no title.
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sources.refetch();
              runs.refetch();
              stats.refetch();
            }}
            className="border-primary/30"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => runPipeline.mutate({ generateNews: true })}
            disabled={isPipelineRunning}
            className="bg-primary hover:bg-primary/90"
            size="sm"
          >
            {isPipelineRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Run Full Pipeline
          </Button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Globe className="h-3.5 w-3.5" />
              Sources
            </div>
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-display)" }}>
              {stats.data?.totalSources || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.data?.enabledSources || 0} active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Database className="h-3.5 w-3.5" />
              Documents
            </div>
            <p className="text-2xl font-bold text-cacti-green" style={{ fontFamily: "var(--font-display)" }}>
              {stats.data?.totalDocumentsIngested || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              in SQLite
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Download className="h-3.5 w-3.5" />
              Ingested
            </div>
            <p className="text-2xl font-bold text-cacti-amber" style={{ fontFamily: "var(--font-display)" }}>
              {stats.data?.totalDocumentsIngested || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              by pipeline
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <BarChart3 className="h-3.5 w-3.5" />
              Runs
            </div>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              {stats.data?.totalRuns || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              total executions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Hexagon className="h-3.5 w-3.5" />
              Tokens
            </div>
            <p className="text-2xl font-bold text-cacti-purple" style={{ fontFamily: "var(--font-display)" }}>
              {((stats.data?.totalTokensUsed || 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              LLM tokens used
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <Clock className="h-3.5 w-3.5" />
              Last Run
            </div>
            <p className="text-sm font-medium text-foreground mt-1">
              {stats.data?.lastRunAt
                ? new Date(stats.data.lastRunAt).toLocaleDateString()
                : "Never"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.data?.lastRunAt
                ? new Date(stats.data.lastRunAt).toLocaleTimeString()
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Source Health Summary */}
      {stats.data?.healthSummary && (
        <Card className="bg-card/50 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Heart className="h-4 w-4 text-primary" />
              Source Health Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Shield className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-lg font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
                    {stats.data.healthSummary.healthy}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400/70">Healthy</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-lg font-bold text-yellow-400" style={{ fontFamily: "var(--font-display)" }}>
                    {stats.data.healthSummary.degraded}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-yellow-400/70">Degraded</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <ShieldAlert className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-lg font-bold text-orange-400" style={{ fontFamily: "var(--font-display)" }}>
                    {stats.data.healthSummary.failing}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Failing</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <ShieldOff className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-lg font-bold text-red-400" style={{ fontFamily: "var(--font-display)" }}>
                    {stats.data.healthSummary.offline}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-red-400/70">Offline</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Sources auto-alert after 3 consecutive failures. Auto-disabled after 5 failures. Alerts throttled to once per 6 hours.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Configuration */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Settings className="h-4 w-4 text-primary" />
              Autonomous Schedule
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {schedule.data?.enabled ? "Pipeline is active" : "Pipeline is paused"}
              </span>
              <Switch
                checked={!!schedule.data?.enabled}
                onCheckedChange={(checked) =>
                  updateSchedule.mutate({ enabled: checked })
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Interval</Label>
              <Select
                value={String(schedule.data?.intervalMinutes || 360)}
                onValueChange={(val) =>
                  updateSchedule.mutate({ intervalMinutes: parseInt(val) })
                }
              >
                <SelectTrigger className="mt-1 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">Every 1 hour</SelectItem>
                  <SelectItem value="180">Every 3 hours</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="720">Every 12 hours</SelectItem>
                  <SelectItem value="1440">Every 24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Auto-Generate News</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={!!schedule.data?.autoGenerateNews}
                  onCheckedChange={(checked) =>
                    updateSchedule.mutate({ autoGenerateNews: checked })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Generate Cacti articles after ingestion
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Next Run</Label>
              <p className="text-sm mt-2">
                {schedule.data?.nextRunAt
                  ? new Date(schedule.data.nextRunAt).toLocaleString()
                  : schedule.data?.enabled
                    ? "Calculating..."
                    : "Paused"}
              </p>
            </div>
          </div>
          {/* Digest Settings Row */}
          <div className="border-t border-border/30 mt-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Weekly Digest</Label>
                <Switch
                  checked={!!schedule.data?.weeklyDigestEnabled}
                  onCheckedChange={(checked) =>
                    updateSchedule.mutate({ weeklyDigestEnabled: checked })
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Digest Day</Label>
                <Select
                  value={String(schedule.data?.digestDayOfWeek ?? 1)}
                  onValueChange={(val) =>
                    updateSchedule.mutate({ digestDayOfWeek: parseInt(val) })
                  }
                >
                  <SelectTrigger className="mt-1 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Last Digest</Label>
                <p className="text-sm mt-2">
                  {schedule.data?.lastDigestSentAt
                    ? new Date(schedule.data.lastDigestSentAt).toLocaleString()
                    : "Never sent"}
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendDigest.mutate()}
                  disabled={sendDigest.isPending}
                  className="border-primary/30 w-full"
                >
                  {sendDigest.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Digest Now
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Globe className="h-4 w-4 text-primary" />
              Data Sources ({sources.data?.length || 0})
            </CardTitle>
            <div className="flex items-center gap-2">
              {(!sources.data || sources.data.length === 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedSources.mutate()}
                  disabled={seedSources.isPending}
                  className="border-cacti-green/30 text-cacti-green hover:bg-cacti-green/10"
                >
                  {seedSources.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Seed Default Sources
                </Button>
              )}
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-primary/30">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-primary/20">
                  <DialogHeader>
                    <DialogTitle style={{ fontFamily: "var(--font-display)" }} className="tracking-wider">
                      ADD INGESTION SOURCE
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newSource.name}
                        onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                        placeholder="e.g., Kingman Daily Miner RSS"
                        className="bg-background/50"
                      />
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={newSource.url}
                        onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                        placeholder="https://..."
                        className="bg-background/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={newSource.type}
                          onValueChange={(val: any) => setNewSource({ ...newSource, type: val })}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rss">RSS Feed</SelectItem>
                            <SelectItem value="webpage">Webpage</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="sitemap">Sitemap</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>City</Label>
                        <Select
                          value={newSource.city}
                          onValueChange={(val) => setNewSource({ ...newSource, city: val })}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kingman">Kingman</SelectItem>
                            <SelectItem value="Bullhead City">Bullhead City</SelectItem>
                            <SelectItem value="Lake Havasu City">Lake Havasu City</SelectItem>
                            <SelectItem value="Mohave County">Mohave County</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={newSource.category}
                          onValueChange={(val) => setNewSource({ ...newSource, category: val })}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="government">Government</SelectItem>
                            <SelectItem value="local_news">Local News</SelectItem>
                            <SelectItem value="public_safety">Public Safety</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="county_news">County News</SelectItem>
                            <SelectItem value="county_board">County Board</SelectItem>
                            <SelectItem value="community">Community</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Source Label</Label>
                        <Input
                          value={newSource.sourceLabel}
                          onChange={(e) => setNewSource({ ...newSource, sourceLabel: e.target.value })}
                          placeholder="e.g., Kingman Daily Miner"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => addSource.mutate(newSource)}
                      disabled={addSource.isPending || !newSource.name || !newSource.url}
                      className="w-full"
                    >
                      {addSource.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Source
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sources.data && sources.data.length > 0 ? (
            <div className="space-y-3">
              {sources.data.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${source.type === "rss" ? "bg-orange-500/10" : "bg-blue-500/10"}`}>
                      {source.type === "rss" ? (
                        <Rss className="h-4 w-4 text-orange-400" />
                      ) : (
                        <Globe className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{source.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${source.enabled ? "bg-cacti-green/10 text-cacti-green" : "bg-muted text-muted-foreground"}`}>
                          {source.enabled ? "Active" : "Paused"}
                        </span>
                        {/* Health badge */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          source.healthStatus === "healthy" ? "bg-emerald-500/10 text-emerald-400" :
                          source.healthStatus === "degraded" ? "bg-yellow-500/10 text-yellow-400" :
                          source.healthStatus === "failing" ? "bg-orange-500/10 text-orange-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>
                          {source.healthStatus || "healthy"}
                          {(source.consecutiveFailures || 0) > 0 && ` (${source.consecutiveFailures})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{source.city}</span>
                        <span>·</span>
                        <span>{source.category}</span>
                        <span>·</span>
                        <span>{source.documentCount} docs</span>
                        {source.lastScrapedAt && (
                          <>
                            <span>·</span>
                            <span>Last: {new Date(source.lastScrapedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      {source.lastError && (
                        <p className="text-xs text-destructive mt-1 truncate">{source.lastError}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Switch
                      checked={!!source.enabled}
                      onCheckedChange={(checked) =>
                        updateSource.mutate({ id: source.id, enabled: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => runSource.mutate({ sourceId: source.id })}
                      disabled={isPipelineRunning}
                      className="h-8 w-8"
                    >
                      {runSource.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this source?")) {
                          deleteSource.mutate({ id: source.id });
                        }
                      }}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No ingestion sources configured</p>
              <p className="text-xs mt-1">Click "Seed Default Sources" to add Mohave County civic data sources</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Clock className="h-4 w-4 text-primary" />
            Recent Pipeline Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.data && runs.data.length > 0 ? (
            <div className="space-y-2">
              {runs.data.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-cacti-green" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : run.status === "running" ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <Clock className="h-5 w-5 text-cacti-amber" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{run.status}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${run.trigger === "scheduled" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {run.trigger}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {run.documentsAnalyzed}/{run.documentsFound} docs · {run.tokensUsed} tokens
                        {run.articlesGenerated > 0 && ` · ${run.articlesGenerated} articles`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                    {(() => {
                      const logArr = run.log as string[] | null;
                      if (!logArr || !Array.isArray(logArr)) return null;
                      return (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(logArr);
                            setLogDialogOpen(true);
                          }}
                          className="text-xs"
                        >
                          View Log
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pipeline runs yet</p>
              <p className="text-xs mt-1">Run the pipeline to start collecting civic intelligence</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="bg-card border-primary/20 max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }} className="tracking-wider">
              PIPELINE LOG
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] rounded-lg bg-background/50 p-4 border border-border/50">
            <pre
              className="text-xs text-muted-foreground whitespace-pre-wrap"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {selectedLog.map((line, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    line.includes("ERROR") || line.includes("FAILED")
                      ? "text-destructive"
                      : line.includes("STORED")
                        ? "text-cacti-green"
                        : line.includes("SKIP")
                          ? "text-muted-foreground/50"
                          : ""
                  }`}
                >
                  {line}
                </div>
              ))}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
