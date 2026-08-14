import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  ShieldAlert,
  Info,
  Filter,
  Plus,
  Settings,
  CheckCircle,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { CityTag } from "@/components/MetaTag";
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

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "CRITICAL",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "WARNING",
  },
  info: {
    icon: Info,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    label: "INFO",
  },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  high_impact: "High Impact Event",
  negative_sentiment: "Negative Sentiment",
  critical_event: "Critical Event",
  keyword: "Keyword Match",
  sentiment_threshold: "Sentiment Threshold",
  impact_level: "Impact Level",
  anomaly: "Anomaly Detected",
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: "text-red-400 border-red-500/30", label: "Active" },
  acknowledged: { color: "text-amber-400 border-amber-500/30", label: "Acknowledged" },
  resolved: { color: "text-green-400 border-green-500/30", label: "Resolved" },
};

type InnerTab = "alerts" | "rules";

export default function AlertsPanel({ showHeader = true }: { showHeader?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [innerTab, setInnerTab] = useState<InnerTab>("alerts");
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: number; name: string; activeCount: number } | null>(null);
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // New rule form state
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    type: "keyword" as "keyword" | "sentiment_threshold" | "impact_level" | "anomaly",
    severity: "warning" as "critical" | "warning" | "info",
    keywords: "",
    threshold: 0.3,
    impactLevel: "High",
  });

  // Queries — fetch ALL persistent alerts regardless of status filter so the
  // tab pill and severity tiles can show true totals. Status filtering happens
  // client-side via `filteredAlerts`.
  const legacyAlerts = trpc.intelligence.alerts.useQuery({ status: "active", limit: 50 });
  const alertStats = trpc.alertRules.stats.useQuery();
  const alertInstances = trpc.alertRules.instances.useQuery({
    status: "all",
    limit: 200,
  });
  const alertRules = trpc.alertRules.list.useQuery();

  // Mutations
  const createRule = trpc.alertRules.create.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      setShowCreateRule(false);
      setNewRule({ name: "", description: "", type: "keyword", severity: "warning", keywords: "", threshold: 0.3, impactLevel: "High" });
      toast.success("Alert rule created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRule = trpc.alertRules.delete.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      utils.alertRules.instances.invalidate();
      utils.alertRules.stats.invalidate();
      toast.success("Rule deleted");
    },
  });

  const toggleRule = trpc.alertRules.update.useMutation({
    onSuccess: () => {
      utils.alertRules.list.invalidate();
      toast.success("Rule updated");
    },
  });

  const acknowledgeAlert = trpc.alertRules.acknowledge.useMutation({
    onSuccess: () => {
      utils.alertRules.instances.invalidate();
      utils.alertRules.stats.invalidate();
      toast.success("Alert acknowledged");
    },
    onError: (err) => toast.error(err.message),
  });

  const resolveAlert = trpc.alertRules.resolve.useMutation({
    onSuccess: () => {
      utils.alertRules.instances.invalidate();
      utils.alertRules.stats.invalidate();
      toast.success("Alert resolved");
    },
    onError: (err) => toast.error(err.message),
  });

  const evaluateRules = trpc.alertRules.evaluate.useMutation({
    onSuccess: (data) => {
      utils.alertRules.instances.invalidate();
      utils.alertRules.stats.invalidate();
      toast.success(`Evaluated ${data.evaluated} documents, ${data.newAlerts} new alerts`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Combine legacy alerts with persistent alert instances
  const allAlerts = [
    ...(alertInstances.data || []).map((a) => ({
      id: String(a.id),
      title: a.title,
      city: a.city || "Unknown",
      type: a.type,
      severity: a.severity,
      summary: a.summary || "",
      publishedDate: a.createdAt ? new Date(a.createdAt).toISOString() : "",
      source: a.source || "Unknown",
      status: a.status,
      isPersistent: true,
      persistentId: a.id,
      documentId: a.documentId,
    })),
    ...(legacyAlerts.data || []).map((a) => ({
      ...a,
      status: "active" as const,
      isPersistent: false,
      persistentId: null,
      documentId: a.id,
    })),
  ];

  const filteredAlerts = allAlerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const severityCounts = allAlerts.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleCreateRule = () => {
    const config: any = {};
    if (newRule.type === "keyword") {
      config.keywords = newRule.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    } else if (newRule.type === "sentiment_threshold") {
      config.threshold = newRule.threshold;
    } else if (newRule.type === "impact_level") {
      config.impactLevel = newRule.impactLevel;
    }
    createRule.mutate({
      name: newRule.name,
      description: newRule.description || undefined,
      type: newRule.type,
      severity: newRule.severity,
      config,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header — hidden when embedded inside a parent surface (e.g. Settings tab) */}
      {showHeader ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ALERTS
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Persistent alert system with configurable rules and state management
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => evaluateRules.mutate()}
                disabled={evaluateRules.isPending}
                className="gap-1.5"
              >
                {evaluateRules.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Evaluate Rules
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {alertStats.data?.active || 0} active
            </Badge>
          </div>
        </div>
      ) : (
        // Embedded mode — just action button and active count, no title block.
        <div className="flex items-center justify-end gap-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => evaluateRules.mutate()}
              disabled={evaluateRules.isPending}
              className="gap-1.5"
            >
              {evaluateRules.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Evaluate Rules
            </Button>
          )}
          <Badge variant="outline" className="text-xs">
            {alertStats.data?.active || 0} active
          </Badge>
        </div>
      )}

      {/* Inner tabs — Alerts feed vs Rules management */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        <button
          onClick={() => setInnerTab("alerts")}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors tracking-wider uppercase ${
            innerTab === "alerts"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <Bell className="h-3.5 w-3.5 inline mr-1.5" />
          Alerts ({allAlerts.length})
        </button>
        <button
          onClick={() => setInnerTab("rules")}
          className={`px-4 py-1.5 text-xs rounded-md transition-colors tracking-wider uppercase ${
            innerTab === "rules"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <Settings className="h-3.5 w-3.5 inline mr-1.5" />
          Rules ({alertRules.data?.length || 0})
        </button>
      </div>

      {innerTab === "alerts" && (
        <>
          {/* Severity Summary */}
          <div className="grid grid-cols-3 gap-3">
            {(["critical", "warning", "info"] as const).map((sev) => {
              const config = SEVERITY_CONFIG[sev];
              const Icon = config.icon;
              const count = severityCounts[sev] || 0;
              const isActive = severityFilter === sev;
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(isActive ? "all" : sev)}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    isActive
                      ? config.bg + " ring-1 ring-primary/30"
                      : "bg-card border-border hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span
                      className={`text-xs tracking-wider uppercase ${config.color}`}
                      style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-2xl font-medium text-foreground mt-1" style={{ fontFamily: "var(--font-display)" }}>
                    {count}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Status:</span>
            {["all", "active", "acknowledged", "resolved"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === s
                    ? "border-primary/30 text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary/20"
                }`}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>

          {/* Alert Feed */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Alert Feed &middot; {filteredAlerts.length} items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(legacyAlerts.isLoading || alertInstances.isLoading) ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">No alerts matching current filter</p>
                  <p className="text-xs text-muted-foreground/60">
                    Create alert rules and evaluate them to generate alerts
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAlerts.map((alert) => {
                    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                    const Icon = config.icon;
                    const statusConf = STATUS_CONFIG[alert.status] || STATUS_CONFIG.active;
                    return (
                      <div
                        key={`${alert.isPersistent ? "p" : "l"}-${alert.id}`}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/20 ${config.bg}`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${statusConf.color}`}
                            >
                              {statusConf.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {ALERT_TYPE_LABELS[alert.type] || alert.type}
                            </Badge>
                            <CityTag value={alert.city} />
                            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                              {alert.publishedDate
                                ? new Date(alert.publishedDate).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                          <p className="text-sm text-foreground font-medium truncate">
                            {alert.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {alert.summary}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              Source: {alert.source}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {alert.documentId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => setLocation(`/documents/${alert.documentId}`)}
                              title="View document"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {alert.isPersistent && alert.status === "active" && user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400"
                              onClick={() => acknowledgeAlert.mutate({ id: alert.persistentId! })}
                              title="Acknowledge"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {alert.isPersistent && alert.status === "acknowledged" && user && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-green-400"
                              onClick={() => resolveAlert.mutate({ id: alert.persistentId! })}
                              title="Resolve"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete rule confirmation */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="tracking-wider text-primary uppercase"
              style={{ fontFamily: "var(--font-display)", fontSize: "14px" }}
            >
              Delete alert rule?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="text-foreground font-medium">{ruleToDelete?.name}</span>?
              {ruleToDelete && ruleToDelete.activeCount > 0 && (
                <>
                  {" "}This will also permanently remove{" "}
                  <span className="text-cacti-amber font-medium">
                    {ruleToDelete.activeCount} alert{ruleToDelete.activeCount === 1 ? "" : "s"}
                  </span>{" "}
                  it created (including any you&apos;ve already acknowledged or resolved). This can&apos;t be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (ruleToDelete) {
                  deleteRule.mutate({ id: ruleToDelete.id });
                  setRuleToDelete(null);
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {innerTab === "rules" && (
        <>
          {/* Create Rule Button */}
          <div className="flex justify-end">
            <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 cacti-glow">
                  <Plus className="h-3.5 w-3.5" />
                  Create Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle
                    className="tracking-wider text-primary uppercase"
                    style={{ fontFamily: "var(--font-display)", fontSize: "14px" }}
                  >
                    Create Alert Rule
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Rule Name</label>
                    <Input
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g., Monitor budget discussions"
                      className="bg-muted/30 border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <Input
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                      placeholder="Optional description"
                      className="bg-muted/30 border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                      <Select
                        value={newRule.type}
                        onValueChange={(v) => setNewRule({ ...newRule, type: v as any })}
                      >
                        <SelectTrigger className="bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="keyword">Keyword Match</SelectItem>
                          <SelectItem value="sentiment_threshold">Sentiment Threshold</SelectItem>
                          <SelectItem value="impact_level">Impact Level</SelectItem>
                          <SelectItem value="anomaly">Anomaly Detection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
                      <Select
                        value={newRule.severity}
                        onValueChange={(v) => setNewRule({ ...newRule, severity: v as any })}
                      >
                        <SelectTrigger className="bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Type-specific config */}
                  {newRule.type === "keyword" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Keywords (comma-separated)
                      </label>
                      <Input
                        value={newRule.keywords}
                        onChange={(e) => setNewRule({ ...newRule, keywords: e.target.value })}
                        placeholder="budget, emergency, water, fire"
                        className="bg-muted/30 border-border"
                      />
                    </div>
                  )}
                  {newRule.type === "sentiment_threshold" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Sentiment Score Threshold (alert below this)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={newRule.threshold}
                        onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) || 0.3 })}
                        className="bg-muted/30 border-border"
                      />
                    </div>
                  )}
                  {newRule.type === "impact_level" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Impact Level</label>
                      <Select
                        value={newRule.impactLevel}
                        onValueChange={(v) => setNewRule({ ...newRule, impactLevel: v })}
                      >
                        <SelectTrigger className="bg-muted/30 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={handleCreateRule}
                    disabled={!newRule.name.trim() || createRule.isPending}
                    className="w-full cacti-glow"
                  >
                    {createRule.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create Rule
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Rules List */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle
                className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
              >
                <Settings className="h-3.5 w-3.5" />
                Alert Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertRules.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !alertRules.data || alertRules.data.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">No alert rules configured</p>
                  <p className="text-xs text-muted-foreground/60">
                    Create rules to automatically detect patterns in civic data
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertRules.data.map((rule) => {
                    const sevConfig = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.info;
                    const SevIcon = sevConfig.icon;
                    const config = rule.config as any;
                    return (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          rule.enabled ? "bg-muted/10 border-border" : "bg-muted/5 border-border/50 opacity-60"
                        }`}
                      >
                        <SevIcon className={`h-5 w-5 shrink-0 ${sevConfig.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-foreground font-medium truncate">
                              {rule.name}
                            </p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {rule.type.replace("_", " ")}
                            </Badge>
                            {!rule.enabled && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {rule.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {config?.keywords && (
                              <span className="text-[10px] text-muted-foreground">
                                Keywords: {config.keywords.join(", ")}
                              </span>
                            )}
                            {config?.threshold !== undefined && rule.type === "sentiment_threshold" && (
                              <span className="text-[10px] text-muted-foreground">
                                Threshold: {config.threshold}
                              </span>
                            )}
                            {config?.impactLevel && rule.type === "impact_level" && (
                              <span className="text-[10px] text-muted-foreground">
                                Level: {config.impactLevel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() =>
                              toggleRule.mutate({
                                id: rule.id,
                                enabled: !rule.enabled,
                              })
                            }
                            title={rule.enabled ? "Disable" : "Enable"}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const cascadeCount =
                                alertInstances.data?.filter((a) => a.ruleId === rule.id).length ?? 0;
                              setRuleToDelete({ id: rule.id, name: rule.name, activeCount: cascadeCount });
                            }}
                            title="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
