import { MapPin, TrendingUp, Radio, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "filled" | "outline";

const TAG_BASE =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap leading-none";

const SENTIMENT: Record<string, { ring: string; dot: string; text: string }> = {
  positive: {
    ring: "border-cacti-green/40 bg-cacti-green/10",
    dot: "bg-cacti-green",
    text: "text-cacti-green",
  },
  neutral: {
    ring: "border-cacti-cyan/40 bg-cacti-cyan/10",
    dot: "bg-cacti-cyan",
    text: "text-cacti-cyan",
  },
  negative: {
    ring: "border-cacti-red/40 bg-cacti-red/10",
    dot: "bg-cacti-red",
    text: "text-cacti-red",
  },
  mixed: {
    ring: "border-cacti-amber/40 bg-cacti-amber/10",
    dot: "bg-cacti-amber",
    text: "text-cacti-amber",
  },
};

const IMPACT: Record<string, { ring: string; text: string }> = {
  high: { ring: "border-cacti-red/40 bg-cacti-red/10", text: "text-cacti-red" },
  medium: { ring: "border-cacti-amber/40 bg-cacti-amber/10", text: "text-cacti-amber" },
  low: { ring: "border-border bg-card", text: "text-muted-foreground" },
};

function asLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function SentimentTag({ value, className }: { value?: unknown; className?: string }) {
  const label = asLabel(value);
  if (!label) return null;
  const key = label.toLowerCase();
  const style = SENTIMENT[key] || SENTIMENT.neutral;
  return (
    <span
      className={cn(TAG_BASE, "border", style.ring, style.text, className)}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );
}

export function ImpactTag({ value, className }: { value?: unknown; className?: string }) {
  const label = asLabel(value);
  if (!label) return null;
  const key = label.toLowerCase();
  // Only render when the value is an actual impact level. Some pipeline
  // paths leak topic strings (e.g. "Community Engagement") into this field;
  // surfacing those as styled impact pills is worse than not rendering.
  if (!IMPACT[key]) return null;
  const style = IMPACT[key];
  return (
    <span
      className={cn(TAG_BASE, "border", style.ring, style.text, className)}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <TrendingUp className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

export function CityTag({ value, className }: { value?: unknown; className?: string }) {
  const label = asLabel(value);
  if (!label) return null;
  // "Out of Region" is a special classification, not a city — render with a
  // globe icon and italic muted treatment so it's visually distinct from
  // actual Mohave County locations.
  if (label === "Out of Region") {
    return (
      <span
        className={cn(
          TAG_BASE,
          "border border-dashed border-border/50 bg-transparent text-muted-foreground/70 italic",
          className
        )}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <Globe className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        TAG_BASE,
        "border border-border/60 bg-card/40 text-muted-foreground",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <MapPin className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

export function SourceTag({ value, className }: { value?: unknown; className?: string }) {
  const label = asLabel(value);
  if (!label) return null;
  return (
    <span
      className={cn(
        TAG_BASE,
        "border border-border/40 bg-transparent text-muted-foreground/80",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <Radio className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

export function MetaRow({
  sentiment,
  impact,
  city,
  source,
  date,
  className,
}: {
  sentiment?: unknown;
  impact?: unknown;
  city?: unknown;
  source?: unknown;
  date?: string | Date | null;
  className?: string;
  variant?: Variant;
}) {
  const dateText = date
    ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <SentimentTag value={sentiment} />
      <ImpactTag value={impact} />
      <CityTag value={city} />
      <SourceTag value={source} />
      {dateText && (
        <span
          className="text-[10px] text-muted-foreground/70 uppercase tracking-wider"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {dateText}
        </span>
      )}
    </div>
  );
}
