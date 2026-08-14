import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SentimentTag, ImpactTag, CityTag, SourceTag } from "@/components/MetaTag";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#06b6d4",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

const CITY_COLORS: Record<string, string> = {
  Kingman: "#06b6d4",
  "Bullhead City": "#a855f7",
  "Lake Havasu City": "#22c55e",
  "Mohave County": "#f59e0b",
};

interface TimelineDay {
  date: string;
  items: Array<{
    id: string;
    title: string;
    city: string;
    source: string;
    sentiment: string | null;
    impactLevel: string | null;
    summary: string | null;
    publishedDate: string | null;
  }>;
}

export default function TimelineView() {
  const [, setLocation] = useLocation();
  const [cityFilter, setCityFilter] = useState("all");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(14); // Show 14 days initially

  // Fetch all documents sorted by date
  const page1 = trpc.documents.list.useQuery({ limit: 100, page: 1, sortBy: "date", sortOrder: "desc" });
  const page2 = trpc.documents.list.useQuery({ limit: 100, page: 2, sortBy: "date", sortOrder: "desc" });
  const page3 = trpc.documents.list.useQuery({ limit: 100, page: 3, sortBy: "date", sortOrder: "desc" });

  const allItems = useMemo(() => {
    const items: any[] = [];
    if (page1.data?.items) items.push(...page1.data.items);
    if (page2.data?.items) items.push(...page2.data.items);
    if (page3.data?.items) items.push(...page3.data.items);
    return items;
  }, [page1.data, page2.data, page3.data]);

  const isLoading = page1.isLoading;

  // Group documents by day
  const timelineDays = useMemo(() => {
    const filtered = cityFilter === "all"
      ? allItems
      : allItems.filter((d) => d.city === cityFilter);

    const dayMap: Record<string, TimelineDay> = {};
    for (const doc of filtered) {
      const dateStr = doc.publishedDate
        ? new Date(doc.publishedDate).toISOString().split("T")[0]
        : "Unknown";
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = { date: dateStr, items: [] };
      }
      dayMap[dateStr].items.push(doc);
    }

    return Object.values(dayMap)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allItems, cityFilter]);

  const visibleDays = timelineDays.slice(0, visibleCount);

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const totalDocs = allItems.length;
  const uniqueCities = useMemo(
    () => Array.from(new Set(allItems.map((d) => d.city).filter(Boolean))).sort(),
    [allItems]
  );

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
              TIMELINE
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Chronological view of civic intelligence events
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              {totalDocs} events
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[200px] bg-card border-border">
              <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {uniqueCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span
            className="text-xs text-muted-foreground tracking-wider"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {timelineDays.length} DAYS · {cityFilter === "all" ? "ALL CITIES" : cityFilter.toUpperCase()}
          </span>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="relative" data-tour="timeline-events">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-1">
              {visibleDays.map((day, dayIndex) => {
                const isExpanded = expandedDays.has(day.date);
                const displayItems = isExpanded ? day.items : day.items.slice(0, 3);
                const hasMore = day.items.length > 3;

                return (
                  <div key={day.date} className="relative pl-14">
                    {/* Timeline dot */}
                    <div className="absolute left-4 top-3 w-5 h-5 rounded-full border-2 border-primary bg-background flex items-center justify-center z-10">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>

                    {/* Day header */}
                    <button
                      onClick={() => toggleDay(day.date)}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/20 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span
                          className="text-sm tracking-wider text-primary"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {day.date === "Unknown"
                            ? "Unknown Date"
                            : new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {day.items.length} {day.items.length === 1 ? "event" : "events"}
                        </Badge>
                      </div>
                      {hasMore && (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </button>

                    {/* Events for this day */}
                    <div className="space-y-1.5 pb-2">
                      {displayItems.map((item) => {
                        const cityColor = CITY_COLORS[item.city] || "#06b6d4";
                        return (
                          <div
                            key={item.id}
                            className="ml-2 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer group"
                            onClick={() => setLocation(`/documents/${item.id}`)}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="w-1 h-full min-h-[40px] rounded-full shrink-0"
                                style={{ backgroundColor: cityColor }}
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-sm font-medium text-foreground line-clamp-1">
                                    {item.title}
                                  </h3>
                                </div>
                                {item.summary && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <CityTag value={item.city} />
                                  <SentimentTag value={item.sentiment} />
                                  <ImpactTag value={item.impactLevel} />
                                  <SourceTag value={item.source} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Show more button */}
                      {hasMore && !isExpanded && (
                        <button
                          onClick={() => toggleDay(day.date)}
                          className="ml-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 py-1"
                        >
                          <ChevronDown className="h-3 w-3" />
                          Show {day.items.length - 3} more events
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more days */}
            {visibleCount < timelineDays.length && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + 14)}
                  className="border-border text-muted-foreground"
                >
                  Load more days ({timelineDays.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </div>
        )}

        {/* City Legend */}
        <div className="flex items-center gap-6 justify-center text-xs text-muted-foreground">
          {Object.entries(CITY_COLORS).map(([city, color]) => (
            <div key={city} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span>{city}</span>
            </div>
          ))}
        </div>
      </div>
    </CactiLayout>
  );
}
