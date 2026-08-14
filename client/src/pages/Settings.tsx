import { useEffect, useState } from "react";
import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Activity,
  Globe,
  Clock,
  Shield,
  Hexagon,
  CheckCircle,
  Key,
  Cpu,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Sparkles,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import IngestionPanel from "@/components/IngestionPanel";
import AlertsPanel from "@/components/AlertsPanel";

type ProviderId = "gemini" | "openai" | "deepseek";

type SettingsTab = "general" | "ai" | "data-monitor" | "alerts" | "admin";

const VALID_TABS: SettingsTab[] = ["general", "ai", "data-monitor", "alerts", "admin"];

const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  defaultModel: string;
  modelSuggestions: string[];
  keyHelpUrl: string;
  keyHelpLabel: string;
  keyPlaceholder: string;
}> = [
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    modelSuggestions: ["gemini-2.5-flash", "gemini-2.5-pro"],
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
    keyHelpLabel: "aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    modelSuggestions: ["gpt-4o-mini", "gpt-4o", "gpt-5-mini"],
    keyHelpUrl: "https://platform.openai.com/api-keys",
    keyHelpLabel: "platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    modelSuggestions: ["deepseek-v4-flash", "deepseek-v4-pro"],
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
    keyHelpLabel: "platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-...",
  },
];

function readTabFromUrl(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const raw = new URLSearchParams(window.location.search).get("tab");
  return VALID_TABS.includes(raw as SettingsTab) ? (raw as SettingsTab) : "general";
}

export default function Settings() {
  const { user, tier, isOwner, signInUrl } = useAuth();
  const isAdmin = isOwner;
  const metrics = trpc.analytics.metrics.useQuery(undefined, { enabled: isAdmin });
  const sourcesQ = trpc.analytics.sourceBreakdown.useQuery(undefined, { enabled: isAdmin });
  const cities = trpc.analytics.cityBreakdown.useQuery(undefined, { enabled: isAdmin });
  const ingestionSourcesQ = trpc.ingestion.listSources.useQuery(undefined, { enabled: isAdmin });
  const usersListQ = trpc.admin.users.list.useQuery(undefined, { enabled: isAdmin });
  const setTierMutation = trpc.admin.users.setTier.useMutation({ onSuccess: () => usersListQ.refetch() });
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAdmin });
  const saveMutation = trpc.settings.save.useMutation({ onSuccess: () => settingsQuery.refetch() });
  const clearMutation = trpc.settings.clearKey.useMutation({ onSuccess: () => settingsQuery.refetch() });
  const testMutation = trpc.settings.testConnection.useMutation();

  const [keyDrafts, setKeyDrafts] = useState<Record<ProviderId, string>>({
    gemini: "",
    openai: "",
    deepseek: "",
  });
  const [modelDrafts, setModelDrafts] = useState<Record<ProviderId, string>>({
    gemini: "",
    openai: "",
    deepseek: "",
  });
  const [testResults, setTestResults] = useState<
    Partial<Record<ProviderId, { success: boolean; message: string }>>
  >({});
  const [rateLimitDraft, setRateLimitDraft] = useState<string>("");

  const [activeTab, setActiveTab] = useState<SettingsTab>(readTabFromUrl);

  // Keep activeTab in sync if the user navigates here from /alerts → /settings?tab=alerts.
  // Listens for popstate (back/forward) and a custom event that the redirect pages dispatch.
  useEffect(() => {
    const onUrlChange = () => setActiveTab(readTabFromUrl());
    window.addEventListener("popstate", onUrlChange);
    return () => window.removeEventListener("popstate", onUrlChange);
  }, []);

  const onTabChange = (value: string) => {
    const next = (VALID_TABS.includes(value as SettingsTab) ? value : "general") as SettingsTab;
    setActiveTab(next);
    const url = new URL(window.location.href);
    if (next === "general") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", next);
    }
    window.history.replaceState({}, "", url.toString());
  };

  const activeProvider: ProviderId = settingsQuery.data?.activeProvider ?? "gemini";

  const setKeyDraft = (id: ProviderId, value: string) =>
    setKeyDrafts((prev) => ({ ...prev, [id]: value }));
  const setModelDraft = (id: ProviderId, value: string) =>
    setModelDrafts((prev) => ({ ...prev, [id]: value }));

  // ─── Card content blocks ──────────────────────────────────────────────
  // Kept inline (not extracted to subcomponents) — that's a separate
  // refactor. Wrapping in tabs is the chunk; card bodies are unchanged.

  const llmConfigCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-cacti-amber" />
          <span
            className="tracking-wider text-cacti-amber uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            LLM Configuration
          </span>
          <Badge variant="outline" className="text-[10px] ml-auto text-cacti-green border-cacti-green/30">
            <CheckCircle className="h-2.5 w-2.5 mr-1" />
            ACTIVE: {activeProvider.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Active provider selector */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            Active Provider
          </Label>
          <Select
            value={activeProvider}
            onValueChange={(v) => saveMutation.mutate({ activeProvider: v as ProviderId })}
          >
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            The active provider handles all LLM calls. Configure each provider below; switch any time.
          </p>
        </div>

        {/* Per-provider config tabs */}
        <Tabs defaultValue={activeProvider} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            {PROVIDERS.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="text-xs">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PROVIDERS.map((p) => {
            const data = settingsQuery.data?.[p.id];
            const hasKey = data?.hasKey ?? false;
            const currentModel = data?.model ?? p.defaultModel;
            const draftKey = keyDrafts[p.id];
            const draftModel = modelDrafts[p.id];
            const testResult = testResults[p.id];
            return (
              <TabsContent key={p.id} value={p.id} className="space-y-4 pt-4">
                {hasKey && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>
                      Current Key
                    </p>
                    <p className="text-xs text-foreground font-mono">{data?.apiKey}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    API Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={p.keyPlaceholder}
                      value={draftKey}
                      onChange={(e) => setKeyDraft(p.id, e.target.value)}
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        saveMutation.mutate({ [`${p.id}ApiKey`]: draftKey } as Record<string, string>);
                        setKeyDraft(p.id, "");
                      }}
                      disabled={!draftKey || saveMutation.isPending}
                    >
                      Save
                    </Button>
                    {hasKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clearMutation.mutate({ provider: p.id })}
                        disabled={clearMutation.isPending}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Get your key at{" "}
                    <a href={p.keyHelpUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {p.keyHelpLabel}
                    </a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    Model
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={p.defaultModel}
                      value={draftModel || currentModel}
                      onChange={(e) => setModelDraft(p.id, e.target.value)}
                      className="font-mono text-xs"
                      list={`${p.id}-models`}
                    />
                    <datalist id={`${p.id}-models`}>
                      {p.modelSuggestions.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const v = (draftModel || currentModel).trim();
                        if (!v) return;
                        saveMutation.mutate({ [`${p.id}Model`]: v } as Record<string, string>);
                        setModelDraft(p.id, "");
                      }}
                      disabled={!draftModel || saveMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Suggested: {p.modelSuggestions.join(", ")}. Any provider-supported model slug works.
                  </p>
                </div>
                <div className="space-y-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await testMutation.mutateAsync({ provider: p.id });
                      setTestResults((prev) => ({ ...prev, [p.id]: result }));
                      settingsQuery.refetch();
                    }}
                    disabled={!hasKey || testMutation.isPending}
                  >
                    Test connection
                  </Button>
                  {testResult && (
                    <p
                      className={`text-[11px] font-mono ${
                        testResult.success ? "text-cacti-green" : "text-destructive"
                      }`}
                    >
                      {testResult.success ? "✓ " : "✗ "}
                      {testResult.message}
                    </p>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Rate Limiting (applies to active provider) */}
        <div className="space-y-2 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rate-limit-enabled"
              checked={settingsQuery.data?.rateLimitEnabled ?? false}
              onCheckedChange={(checked) =>
                saveMutation.mutate({ rateLimitEnabled: checked === true })
              }
            />
            <Label
              htmlFor="rate-limit-enabled"
              className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Enable rate limiting
            </Label>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              max={1000}
              step={1}
              placeholder={String(settingsQuery.data?.rateLimitPerSecond ?? 1)}
              value={rateLimitDraft}
              onChange={(e) => setRateLimitDraft(e.target.value)}
              disabled={!settingsQuery.data?.rateLimitEnabled}
              className="font-mono text-xs w-32"
            />
            <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              requests / second
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const n = Number(rateLimitDraft);
                if (Number.isFinite(n) && n >= 0 && n <= 1000) {
                  saveMutation.mutate({ rateLimitPerSecond: n });
                  setRateLimitDraft("");
                }
              }}
              disabled={!rateLimitDraft || !settingsQuery.data?.rateLimitEnabled || saveMutation.isPending}
            >
              Save
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            When enabled, LLM requests are throttled to at most this many per second.
            Currently:{" "}
            <span className="font-mono">
              {settingsQuery.data?.rateLimitEnabled
                ? `${settingsQuery.data?.rateLimitPerSecond ?? 1} req/s`
                : "disabled"}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const systemStatusCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cpu className="h-4 w-4 text-primary" />
          <span
            className="tracking-wider text-primary uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            System Status
          </span>
          <Badge variant="outline" className="text-[10px] ml-auto text-cacti-green border-cacti-green/30">
            <Activity className="h-2.5 w-2.5 mr-1 cacti-pulse" />
            OPERATIONAL
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              System Version
            </p>
            <p className="text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              The Cacti v1.0
            </p>
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Database
            </p>
            <p className="text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              SQLite 3
            </p>
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              AI Engine
            </p>
            <p className="text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {settingsQuery.data?.[activeProvider]?.model ?? "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Collection Cycle
            </p>
            <p className="text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              Every 1 hour
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const operatorProfileCard = user ? (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-cacti-purple" />
          <span
            className="tracking-wider text-cacti-purple uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            Operator Profile
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Name
            </p>
            <p className="text-sm text-foreground">{user?.name || "Unknown"}</p>
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Email
            </p>
            <p className="text-sm text-foreground">{user?.email || "Unknown"}</p>
          </div>
          <div className="space-y-1">
            <p
              className="text-[10px] text-muted-foreground uppercase tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Access Tier
            </p>
            <Badge
              variant="outline"
              className={`text-xs ${
                isAdmin
                  ? "text-cacti-green border-cacti-green/30"
                  : "text-cacti-amber border-cacti-amber/30"
              }`}
            >
              {tier.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  const usersCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UsersIcon className="h-4 w-4 text-cacti-cyan" />
          <span
            className="tracking-wider text-cacti-cyan uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            Users
          </span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {usersListQ.data?.length ?? 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {usersListQ.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="space-y-1">
            {(usersListQ.data ?? []).map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 font-medium">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: "var(--font-mono)" }}>
                    {u.email}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0 hidden md:block" style={{ fontFamily: "var(--font-mono)" }}>
                  last seen {new Date(u.lastSeenAt).toLocaleDateString()}
                </p>
                <Select
                  value={u.tier}
                  onValueChange={(v) => {
                    if (v === u.tier) return;
                    setTierMutation.mutate({ userId: u.id, tier: v as "public" | "invited" | "owner" });
                  }}
                  disabled={u.id === user?.id}
                >
                  <SelectTrigger className="text-xs h-8 w-[110px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public" className="text-xs">public</SelectItem>
                    <SelectItem value="invited" className="text-xs">invited</SelectItem>
                    <SelectItem value="owner" className="text-xs">owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {(usersListQ.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No users yet. Sign-ups will appear here.
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          You can't demote your own owner account. New sign-ups default to <span className="font-mono">invited</span>.
        </p>
      </CardContent>
    </Card>
  );

  const databaseStatsCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-cacti-cyan" />
          <span
            className="tracking-wider text-cacti-cyan uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            Database Statistics
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metrics.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Total Documents
              </p>
              <p className="text-xl text-cacti-cyan" style={{ fontFamily: "var(--font-display)" }}>
                {metrics.data?.totalDocuments ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                AI Analyzed
              </p>
              <p className="text-xl text-cacti-green" style={{ fontFamily: "var(--font-display)" }}>
                {metrics.data?.analyzedDocuments ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Coverage
              </p>
              <p className="text-xl text-cacti-amber" style={{ fontFamily: "var(--font-display)" }}>
                {metrics.data?.analysisCoverage ?? 0}%
              </p>
            </div>
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Data Sources
              </p>
              <p className="text-xl text-cacti-purple" style={{ fontFamily: "var(--font-display)" }}>
                {metrics.data?.totalSources ?? 0}
              </p>
            </div>
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Cities Monitored
              </p>
              <p className="text-xl text-primary" style={{ fontFamily: "var(--font-display)" }}>
                {metrics.data?.totalCities ?? 0}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const dataSourcesCard = (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-cacti-green" />
          <span
            className="tracking-wider text-cacti-green uppercase"
            style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
          >
            Data Sources
          </span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {ingestionSourcesQ.data?.length ?? 0} configured
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ingestionSourcesQ.isLoading ? (
          <Skeleton className="h-24" />
        ) : (ingestionSourcesQ.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No ingestion sources configured. Visit the Data Monitor tab to add some.
          </p>
        ) : (
          <div className="space-y-2">
            {(ingestionSourcesQ.data ?? []).map((source) => {
              const intervalLabel =
                source.intervalMinutes <= 60
                  ? "Hourly"
                  : source.intervalMinutes <= 360
                  ? "Every 6h"
                  : source.intervalMinutes <= 1440
                  ? "Daily"
                  : "Weekly";
              return (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle
                      className={`h-4 w-4 shrink-0 ${
                        source.healthStatus === "healthy" ? "text-cacti-green" : "text-cacti-amber"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{source.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {source.type} · {source.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {intervalLabel}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        source.enabled
                          ? "text-cacti-green border-cacti-green/30"
                          : "text-muted-foreground"
                      }`}
                    >
                      {source.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const sourceBreakdownGrid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle
            className="text-xs tracking-wider text-muted-foreground uppercase"
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
          >
            Documents by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sourcesQ.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2">
              {(sourcesQ.data || []).map((s: { source: string; count: number }) => (
                <div key={s.source} className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate">{s.source}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle
            className="text-xs tracking-wider text-muted-foreground uppercase"
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
          >
            Documents by City
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cities.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="space-y-2">
              {(cities.data || []).map((c: { city: string; count: number }) => (
                <div key={c.city} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{c.city}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const aboutCard = (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Hexagon className="h-10 w-10 text-primary shrink-0" />
          <div>
            <h2
              className="text-lg tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              THE CACTI — AI LOCAL NEWSPAPER
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              AI-powered local newspaper for Mohave County, Arizona civic activity.
              Automated data collection, sentiment analysis, entity extraction, and intelligence reporting.
            </p>
            <p
              className="text-[10px] text-muted-foreground mt-2 tracking-wider"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Cacti SYSTEM v1.0 &middot; MOHAVE COUNTY, ARIZONA &middot; BUILT WITH REACT + TYPESCRIPT + SQLITE
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <CactiLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1
            className="text-xl md:text-2xl tracking-wider text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            SETTINGS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System configuration and data source management
          </p>
        </div>

        {/* Anonymous (signed-out) — minimal sign-in prompt */}
        {!user && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <Hexagon className="h-8 w-8 text-primary" />
              <div className="space-y-1">
                <p className="text-sm text-foreground">Sign in to access your account.</p>
                <p className="text-xs text-muted-foreground">
                  Most settings are owner-only. Anonymous visitors browse with 24-hour-old data.
                </p>
              </div>
              <Button onClick={() => { window.location.href = signInUrl; }}>
                Sign in with Google
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Non-admin signed-in users — minimal info card + profile + about */}
        {user && !isAdmin && (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-2">
                <p className="text-sm text-foreground">
                  You're signed in as <span className="font-medium">{user.email}</span>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Your access tier: <span className="font-mono uppercase text-primary">{tier}</span>.
                  Configuration, data sources, and admin tools are owner-only.
                </p>
              </CardContent>
            </Card>
            {operatorProfileCard}
          </>
        )}

        {/* Owner tier — tabbed surface */}
        {isAdmin && (
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="general" className="text-xs gap-1.5">
                <SettingsIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
              <TabsTrigger value="data-monitor" className="text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Data Monitor</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-6">
              {operatorProfileCard}
              {aboutCard}
            </TabsContent>

            <TabsContent value="ai" className="space-y-6 mt-6">
              {llmConfigCard}
            </TabsContent>

            <TabsContent value="data-monitor" className="space-y-6 mt-6">
              <IngestionPanel showHeader={false} />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6 mt-6">
              <AlertsPanel showHeader={false} />
            </TabsContent>

            <TabsContent value="admin" className="space-y-6 mt-6">
              {systemStatusCard}
              {usersCard}
              {databaseStatsCard}
              {dataSourcesCard}
              {sourceBreakdownGrid}
            </TabsContent>
          </Tabs>
        )}

        {/* About card — shown to non-owners; for owners it lives in General tab */}
        {!isAdmin && aboutCard}
      </div>
    </CactiLayout>
  );
}
