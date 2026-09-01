<p align="center">
  <img src="docs/screenshots/the-cacti-banner.png" alt="The Cacti, framed by two cactus-eye marks against an Arizona sky and desert earth." width="1000">
</p>

## What is this?

The Cacti collects Mohave County public records and regional news in one place. It turns that material into city newspaper editions, a searchable document collection, maps, timelines, relationship views, alerts, and reports.

Generated newspaper stories link back to their source material so you can check the original record.

## Who is this for?

The Cacti is for people who want to follow Mohave County public information without checking every city, county, and news website separately. The person running the installation controls the sources, ingestion schedule, alerts, access levels, and AI provider.

## What it actually does

- Collects configured RSS feeds and public webpages.
- Skips duplicate items and records whether each source is working.
- Uses Gemini, OpenAI, or DeepSeek to classify topics, extract recurring people, organizations, and locations, and create draft summaries.
- Builds newspaper editions for Kingman, Bullhead City, Lake Havasu City, Mohave County, and broader Arizona coverage.
- Provides document search, map, timeline, and relationship-graph views.
- Answers questions and generates reports from the collected documents.
- Sends configurable alerts based on keywords, topics, sentiment, and estimated impact.
- Separates anonymous, signed-in, and owner access.

> AI-generated summaries, stories, and reports can be wrong. Check the linked source before relying on a generated claim.

![The Cacti newspaper view in a fresh installation](docs/screenshots/the-cacti-newspaper.png)

## Running it locally

The Cacti is self-hosted. A new installation contains no records until you configure sources and run the ingestion pipeline.

You will need:

- [Node.js](https://nodejs.org/) 20 or newer.
- [pnpm](https://pnpm.io/installation) 10.
- A Google OAuth web application.
- A long random JWT secret.
- An API key for Gemini, OpenAI, or DeepSeek.

Clone and install the project:

```bash
git clone https://github.com/anitacigawet/The-Cacti.git
cd The-Cacti

pnpm install
cp .env.example .env
```

Add the following to `.env`:

- your Google OAuth client ID and secret;
- a `JWT_SECRET`;
- the owner email as `OWNER_EMAIL`;
- at least one supported AI provider key, either in `.env` or later through Settings.

Use this authorized redirect URI for local Google OAuth:

```text
http://localhost:3002/api/auth/google/callback
```

Start the application:

```bash
pnpm dev
```

Open [http://localhost:3002/about](http://localhost:3002/about). On Windows, `start.bat` runs the same local startup flow and looks for an available port beginning with 3002.

After signing in with the owner email:

1. Open **Settings** and choose an AI provider.
2. Open **Data Monitor** and seed the default source list.
3. Run the pipeline manually once.
4. Review the collected documents and generated output before enabling a schedule.

The database and settings are stored under `data/`, which Git ignores. See [Configuration](docs/CONFIGURATION.md) for the complete environment reference.

## ⚙️ Extreme technicals below

### Known limits

- The default source catalog does not contain every Mohave County public-information source.
- Public websites change, so individual source adapters can stop working and require maintenance.
- A fresh installation does not include a populated database.

### How the repository is organized

- **`client/`** — React application and public, research, and owner views.
- **`server/`** — Express and tRPC server, ingestion pipeline, authentication, alerts, and AI routing.
- **`shared/`** — region settings and types used by the client and server.
- **`config/`** — default Mohave County source catalog.
- **`drizzle/`** — SQLite schema and migrations.
- **`docs/`** — configuration documentation and screenshots.
- **`scripts/`** — maintenance utilities.

Regional adaptation points are documented in [Forking The Cacti](FORKING.md).

### Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Do not include API keys, account data, runtime databases, or personal records.

### License

The Cacti is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE), not open source. ScootSolute LLC licenses the project for permitted noncommercial use; commercial use is not granted. Third-party packages keep their own licenses.
