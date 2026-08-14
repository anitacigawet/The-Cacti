export const ONBOARDING_VERSION = "v1";
export const ONBOARDING_STORAGE_KEY = "cacti-onboarded";

export type OnboardingStep = {
  id: string;
  path: string;
  /** CSS selector for the element to ring. Omit for a centered modal step. */
  highlightSelector?: string;
  title: string;
  narration: string;
  /** Auto-advance delay in ms; null disables auto-advance (used for the finale). */
  readingTimeMs: number | null;
  isFinale?: boolean;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    path: "/newspaper",
    title: "Welcome to The Cacti",
    narration:
      "Local public records and regional news for Mohave County, gathered into a daily reading view and several research tools. Here's a short tour. Skip anytime.",
    readingTimeMs: 7000,
  },
  {
    id: "newspaper",
    path: "/newspaper",
    highlightSelector: '[data-tour="city-tabs"]',
    title: "The daily newspaper",
    narration:
      "Each day The Cacti writes a newspaper edition for every Mohave city. Tap a city to read its stories. The cactus-eye wordmark in the top-left always brings you back here.",
    readingTimeMs: 9000,
  },
  {
    id: "news",
    path: "/news",
    highlightSelector: '[data-tour="news-feed-list"]',
    title: "News Feed — the raw stream",
    narration:
      "Beneath the polished editions, the News Feed lists every article we've ingested. Filter it by sentiment, source, or city to dig into what's happening right now.",
    readingTimeMs: 8000,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    highlightSelector: '[data-tour="dashboard-metrics"]',
    title: "Dashboard — your operational picture",
    narration:
      "A live overview: document volume, sentiment breakdown, source health, and the most-mentioned entities. This is your at-a-glance state of the region.",
    readingTimeMs: 8000,
  },
  {
    id: "entities",
    path: "/entities",
    highlightSelector: '[data-tour="entity-graph-canvas"]',
    title: "Entity Graph",
    narration:
      "Every person, organization, and place mentioned across the corpus, connected by how often they appear together. Hover a node to trace its links; click to read its documents.",
    readingTimeMs: 10000,
  },
  {
    id: "timeline",
    path: "/timeline",
    highlightSelector: '[data-tour="timeline-events"]',
    title: "Timeline",
    narration:
      "Everything that's happened, in order — grouped by day, with city-colored markers. Expand any event to see the documents behind it.",
    readingTimeMs: 7000,
  },
  {
    id: "documents",
    path: "/documents",
    highlightSelector: '[data-tour="documents-search"]',
    title: "Documents — the full corpus",
    narration:
      "Search and filter every document we've collected. Open any card to read it with AI-extracted people, places, and organizations highlighted inline.",
    readingTimeMs: 8000,
  },
  {
    id: "reports",
    path: "/reports",
    highlightSelector: '[data-tour="reports-generate"]',
    title: "Reports — on-demand briefs",
    narration:
      "Generate AI-written briefs from the current corpus — a daily summary, a weekly digest, or a custom-prompt report. Each one cites the documents it drew from.",
    readingTimeMs: 8000,
  },
  {
    id: "intelligence",
    path: "/intelligence",
    highlightSelector: '[data-tour="intelligence-input"]',
    title: "Intelligence — ask anything",
    narration:
      "The most powerful tool: ask a plain-English question and get a cited answer that quotes the underlying sources. Each query costs about half a cent.",
    readingTimeMs: 10000,
  },
  {
    id: "api-key",
    path: "/settings",
    title: "Last step — add your API key",
    narration:
      "To switch on the AI features — Reports, Intelligence, the daily newspaper — paste a key from Gemini, OpenAI, or DeepSeek. Keys stay on your own server; The Cacti never proxies them.",
    readingTimeMs: null,
    isFinale: true,
  },
];

/** Owner-tier first-visit gate. */
export function shouldAutoStartOnboarding(tier: string | undefined): boolean {
  if (tier !== "owner") return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== ONBOARDING_VERSION;
  } catch {
    return false;
  }
}
