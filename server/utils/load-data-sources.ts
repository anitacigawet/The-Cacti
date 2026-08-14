import fs from "fs/promises";
import path from "path";

/**
 * Data source configuration loader
 * Supports loading from config/data-sources.json
 * Falls back to default sources if config file not found
 */

export interface DataSource {
  name: string;
  url: string;
  type: "rss" | "webpage";
  city: string;
  category: string;
  sourceLabel: string;
  intervalMinutes: number;
  enabled?: boolean;
}

export interface DataSourcesConfig {
  sources: DataSource[];
  metadata?: {
    version?: string;
    description?: string;
    lastUpdated?: string;
    notes?: string;
  };
}

/**
 * Load data sources from config file or return defaults
 */
export async function loadDataSources(): Promise<DataSource[]> {
  try {
    // Try to load from config file
    const configPath = path.join(process.cwd(), "config", "data-sources.json");
    const configContent = await fs.readFile(configPath, "utf-8");
    const config: DataSourcesConfig = JSON.parse(configContent);

    // Filter enabled sources
    const enabledSources = config.sources.filter((s) => s.enabled !== false);

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[DataSources] Loaded ${enabledSources.length} sources from config/data-sources.json`
      );
    }

    return enabledSources;
  } catch (err: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[DataSources] Config file not found or invalid, using defaults:`,
        err.message
      );
    }

    // Return default sources
    return getDefaultSources();
  }
}

/**
 * Get default data sources (hardcoded fallback)
 */
function getDefaultSources(): DataSource[] {
  return [
    // Kingman sources
    {
      name: "City of Kingman - Official Website",
      url: "https://www.cityofkingman.gov",
      type: "webpage",
      city: "Kingman",
      category: "government",
      sourceLabel: "City of Kingman",
      intervalMinutes: 360,
      enabled: true,
    },
    {
      name: "Kingman Daily Miner - Local News",
      url: "https://www.kdminer.com/feed/",
      type: "rss",
      city: "Kingman",
      category: "local_news",
      sourceLabel: "Kingman Daily Miner",
      intervalMinutes: 180,
      enabled: true,
    },
    // Bullhead City sources
    {
      name: "City of Bullhead City - Official Website",
      url: "https://www.bullheadcity.com",
      type: "webpage",
      city: "Bullhead City",
      category: "government",
      sourceLabel: "City of Bullhead City",
      intervalMinutes: 360,
      enabled: true,
    },
    {
      name: "Mohave Valley Daily News",
      url: "https://mohavedailynews.com/feed/",
      type: "rss",
      city: "Bullhead City",
      category: "local_news",
      sourceLabel: "Mohave Daily News",
      intervalMinutes: 180,
      enabled: true,
    },
    // Lake Havasu City sources
    {
      name: "City of Lake Havasu - Official Website",
      url: "https://www.lhcaz.gov",
      type: "webpage",
      city: "Lake Havasu City",
      category: "government",
      sourceLabel: "City of Lake Havasu",
      intervalMinutes: 360,
      enabled: true,
    },
    {
      name: "Havasu News-Herald",
      url: "https://www.havasunews.com/search/?f=rss",
      type: "rss",
      city: "Lake Havasu City",
      category: "local_news",
      sourceLabel: "Havasu News-Herald",
      intervalMinutes: 180,
      enabled: true,
    },
    // Mohave County sources
    {
      name: "Mohave County Government",
      url: "https://www.mohavecounty.us",
      type: "webpage",
      city: "Mohave County",
      category: "county_news",
      sourceLabel: "Mohave County Government",
      intervalMinutes: 360,
      enabled: true,
    },
    {
      name: "Mohave County Board of Supervisors",
      url: "https://www.mohavecounty.us/ContentPage.aspx?id=127",
      type: "webpage",
      city: "Mohave County",
      category: "county_board",
      sourceLabel: "Mohave County Government",
      intervalMinutes: 720,
      enabled: true,
    },
  ];
}

/**
 * Validate data source configuration
 */
export function validateDataSource(source: any): source is DataSource {
  return (
    typeof source.name === "string" &&
    typeof source.url === "string" &&
    (source.type === "rss" || source.type === "webpage") &&
    typeof source.city === "string" &&
    typeof source.category === "string" &&
    typeof source.sourceLabel === "string" &&
    typeof source.intervalMinutes === "number" &&
    source.intervalMinutes > 0
  );
}
