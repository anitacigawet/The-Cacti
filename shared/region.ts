/**
 * Region configuration — the canonical instance covers Mohave County, Arizona.
 *
 * Region names, editions, and newspaper labels used across the application
 * are kept here so the client and server use the same values.
 */

export const REGION_NAME = "Mohave County";
export const STATE_NAME = "Arizona";
export const STATE_CODE = "AZ";
export const LOCALE = "en-US";

/**
 * Cities the newspaper generates primary editions for. Mohave-first identity:
 * these are The Cacti's home coverage and always show as the top tab row.
 */
export const MOHAVE_CITIES: readonly string[] = [
  "Kingman",
  "Bullhead City",
  "Lake Havasu City",
  "Mohave County",
];

/**
 * Secondary "Across Arizona" wire-style editions for content that's
 * Arizona-relevant but not Mohave-centric. Sourced from the same feeds (most
 * of which cover statewide news) — keeps the data usable instead of
 * discarding it. Real local papers run a state wire section the same way.
 */
export const ARIZONA_WIRE_CITIES: readonly string[] = [
  "Phoenix Metro",
  "Flagstaff Area",
  "Tucson Metro",
  "Other Arizona",
];

/** Convenience: every city the newspaper system knows about. */
export const CITIES: readonly string[] = [...MOHAVE_CITIES, ...ARIZONA_WIRE_CITIES];

/** Per-city flavor strings. Used as newspaper masthead taglines. */
export const CITY_TAGLINES: Record<string, string> = {
  Kingman: "The Heart of Historic Route 66",
  "Bullhead City": "Where the Colorado Bends",
  "Lake Havasu City": "Arizona's Playground",
  "Mohave County": "Civic Pulse of the Tri-State Region",
  "Phoenix Metro": "The Valley of the Sun",
  "Flagstaff Area": "Beneath the San Francisco Peaks",
  "Tucson Metro": "The Old Pueblo",
  "Other Arizona": "Across the Grand Canyon State",
};

/** Newspaper masthead. */
export const NEWSPAPER_NAME = "The Cacti";
export const NEWSPAPER_TAGLINE = "Public Records and Regional News";

/** Categories used for ingested document classification. */
export const DOCUMENT_CATEGORIES: readonly string[] = [
  "government",
  "public_safety",
  "infrastructure",
  "environment",
  "education",
  "economy",
  "community",
  "health",
];

/** Used in LLM system prompts to ground the model on the project's scope. */
export const REGION_CONTEXT_BLURB =
  `${REGION_NAME}, ${STATE_NAME} — covering local government, public records, civic news, and ` +
  `community activity in ${CITIES.slice(0, -1).join(", ")} and the broader ${REGION_NAME} area.`;
