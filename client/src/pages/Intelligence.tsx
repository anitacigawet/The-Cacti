import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain,
  Send,
  Loader2,
  FileText,
  Sparkles,
  Clock,
  AlertTriangle,
  History,
  Trash2,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { SentimentTag, ImpactTag, CityTag } from "@/components/MetaTag";

const EXAMPLE_QUERIES = [
  "What are the main themes in recent civic activity?",
  "Are there any high-impact events in Kingman?",
  "Summarize economic development trends in Mohave County",
  "What organizations are most active in local government?",
  "Are there any concerning patterns in recent data?",
];

export default function Intelligence() {
  const [query, setQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [result, setResult] = useState<{
    answer: string;
    tokensUsed: number;
    sourcesConsulted: number;
    model: string;
  } | null>(null);

  const { user } = useAuth();
  const utils = trpc.useUtils();

  const queryHistoryList = trpc.queryHistory.list.useQuery(
    { limit: 30 },
    { enabled: !!user }
  );

  const saveQuery = trpc.queryHistory.save.useMutation({
    onSuccess: () => {
      utils.queryHistory.list.invalidate();
    },
  });

  const deleteQuery = trpc.queryHistory.delete.useMutation({
    onSuccess: () => {
      utils.queryHistory.list.invalidate();
    },
  });

  const clearHistory = trpc.queryHistory.clearAll.useMutation({
    onSuccess: () => {
      utils.queryHistory.list.invalidate();
    },
  });

  const aiQuery = trpc.intelligence.query.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setIsQuerying(false);
      // Auto-save to history if user is logged in
      if (user) {
        saveQuery.mutate({
          question: query.trim(),
          answer: data.answer,
          tokensUsed: data.tokensUsed,
          sourcesConsulted: data.sourcesConsulted,
          model: data.model,
        });
      }
    },
    onError: () => {
      setIsQuerying(false);
    },
  });

  const recentIntel = trpc.analytics.recentIntelligence.useQuery({ limit: 10 });

  const handleQuery = () => {
    if (!query.trim()) return;
    setIsQuerying(true);
    setResult(null);
    aiQuery.mutate({ question: query.trim() });
  };

  const loadFromHistory = (question: string, answer: string) => {
    setQuery(question);
    setResult({
      answer,
      tokensUsed: 0,
      sourcesConsulted: 0,
      model: "cached",
    });
    setShowHistory(false);
  };

  return (
    <CactiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              INTELLIGENCE
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered natural language queries and intelligence analysis
            </p>
          </div>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Query History</span>
              {queryHistoryList.data && queryHistoryList.data.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                  {queryHistoryList.data.length}
                </Badge>
              )}
            </Button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Main content */}
          <div className={`flex-1 space-y-6 min-w-0 ${showHistory ? "max-w-[calc(100%-320px)]" : ""}`}>
            {/* AI Query Interface */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Brain className="h-4 w-4 text-primary" />
                  <span
                    className="tracking-wider text-primary uppercase"
                    style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}
                  >
                    AI Query Interface
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Example queries */}
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUERIES.map((eq) => (
                    <button
                      key={eq}
                      onClick={() => setQuery(eq)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      {eq}
                    </button>
                  ))}
                </div>

                {/* Query input */}
                <div className="flex gap-2" data-tour="intelligence-input">
                  <Textarea
                    placeholder="Ask a question about Mohave County civic activity..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bg-muted/30 border-border resize-none min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleQuery();
                      }
                    }}
                  />
                  <Button
                    onClick={handleQuery}
                    disabled={isQuerying || !query.trim()}
                    className="cacti-glow self-end"
                  >
                    {isQuerying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Loading state */}
                {isQuerying && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border border-primary/20">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    <div>
                      <p className="text-sm text-foreground">Analyzing data...</p>
                      <p className="text-xs text-muted-foreground">
                        Querying documents and generating intelligence report
                      </p>
                    </div>
                  </div>
                )}

                {/* Result */}
                {result && (
                  <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span
                          className="text-xs tracking-wider text-primary uppercase"
                          style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                        >
                          Intelligence Report
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.model !== "cached" && (
                          <>
                            <Badge variant="outline" className="text-[10px]">
                              {result.sourcesConsulted} sources
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {result.tokensUsed} tokens
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {result.model}
                            </Badge>
                          </>
                        )}
                        {result.model === "cached" && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                            from history
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none">
                      <Streamdown>{result.answer}</Streamdown>
                    </div>
                  </div>
                )}

                {/* Error */}
                {aiQuery.error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                      {aiQuery.error.message || "Failed to process query"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Intelligence Feed */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle
                  className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Recent Intelligence Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentIntel.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(recentIntel.data || []).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm text-foreground truncate font-medium">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.summary}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <SentimentTag value={item.sentiment} />
                            <ImpactTag value={item.impactLevel} />
                            <CityTag value={item.city} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Query History Sidebar */}
          {showHistory && (
            <div className="w-[300px] shrink-0">
              <Card className="bg-card border-border sticky top-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <History className="h-4 w-4 text-primary" />
                      <span
                        className="tracking-wider text-primary uppercase"
                        style={{ fontFamily: "var(--font-display)", fontSize: "11px" }}
                      >
                        Query History
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {queryHistoryList.data && queryHistoryList.data.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearHistory.mutate()}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Clear all history"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(false)}
                        className="h-7 w-7 p-0 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto">
                  {queryHistoryList.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14" />
                      ))}
                    </div>
                  ) : !queryHistoryList.data || queryHistoryList.data.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No queries yet</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Your AI queries will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {queryHistoryList.data.map((entry) => (
                        <div
                          key={entry.id}
                          className="group p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                          onClick={() => loadFromHistory(entry.question, entry.answer)}
                        >
                          <p className="text-xs text-foreground line-clamp-2 font-medium">
                            {entry.question}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadFromHistory(entry.question, entry.answer);
                                }}
                                title="Reload query"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteQuery.mutate({ id: entry.id });
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </CactiLayout>
  );
}
