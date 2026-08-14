# Forking The Cacti

The Cacti is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). It was built for Mohave County, Arizona. **Forks are not actively supported** — there is no guaranteed issue triage, pull-request review, or documentation effort for community deployments.

You may fork and adapt it for noncommercial purposes under the license terms. The intended path is to let an AI assistant help with the customization work.

## How to fork

### 1. Fork the repo on GitHub

Standard "Fork" button. Then `git clone` your fork.

### 2. Get the canonical instance running locally first

Before you customize anything, confirm the project runs end-to-end on your machine as-is:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3002, paste a Gemini / OpenAI / DeepSeek API key in Settings, and confirm an LLM call works. If anything is broken at this stage, fix the local boot path before changing the regional configuration.

### 3. Talk to an AI

The Cacti is structured so the things a forker would want to change all live in a small set of files. Upload the codebase to Claude, ChatGPT, Cursor, or any coding-capable AI, and use this prompt:

```
I forked The Cacti. I want to adapt it for [describe your region — e.g.
"Linn County, Iowa", "Maricopa County, AZ", "Multnomah County, OR" —
or your different topic, audience, etc.].

The codebase is in this conversation. The config / customization layer
I'm allowed to touch is at:

  - shared/region.ts                 (region name, cities, taglines, categories)
  - config/data-sources.json         (URLs / RSS feeds the scheduler ingests)
  - server/_core/llm/prompts/        (prompt templates — start with
                                      intelligence-system.ts as a pattern;
                                      extract more inline prompts if needed)

Please:

1. Read every file in those locations first.
2. Explain what each file does and what's safe for me to change.
3. Ask me what specifically I want different for my version (region,
   sources, branding, etc.).
4. Walk me through the edits one file at a time. Confirm with me before
   each change.
5. Do NOT refactor anything outside those locations. If something looks
   like it needs structural change, flag it and stop — that's beyond a
   fork into a derivative project.
6. When we're done, give me the commands to run my customized version
   locally and brief notes on what to set in Settings.
```

The AI will guide you the rest of the way.

## What's safe to change in your fork

- **Region / city list** — `shared/region.ts` exports `REGION_NAME`, `STATE_NAME`, `STATE_CODE`, `CITIES`, `CITY_TAGLINES`, `DOCUMENT_CATEGORIES`, and a system-prompt blurb. Edit these and most of the app re-themes itself.
- **Data sources** — the URLs, RSS feeds, and scrape targets in `config/data-sources.json`. The canonical instance ships with Mohave County sources; replace them with your own region's.
- **Prompt templates** — `server/_core/llm/prompts/` holds extracted prompt templates that pull from `shared/region.ts`. Inline prompts that haven't been extracted yet can be migrated by the AI as needed for your fork.
- **Branding** — name, logo, colors, fonts, tagline. "The Cacti" is the public name; "Cacti" is internal codename / aesthetic flavor. Both surface in UI strings the AI can find and replace.
- **Defaults** — refresh interval, tier thresholds (if you adopt the tiered access model), default LLM provider.

## What's NOT safe to change

If your AI starts touching these without a clear reason, stop it:

- **The LLM router** (`server/_core/llm/`) — the multi-provider abstraction is shared across all forks. Provider edits go in the config layer, not the router.
- **Database schema** (`drizzle/schema.ts`). If you genuinely need new fields, you've crossed from "fork" into "derivative project" — that's fine, but it's outside the AI-assisted-fork pattern's scope.
- **Routing structure** (`client/src/App.tsx`, `server/routers.ts`). If you want a new page or a new API route, that's structural; ask the AI to walk you through it carefully and don't expect support.
- **Auth / tier logic.** The freshness-throttling and access tiers are core; tampering risks data leaks.

## Getting help

- For your fork: please don't open issues asking for help. Use the AI prompt above. If you've found a real bug in the canonical project that affects your fork too, a clear, reproducible bug report is welcome — but customization questions will be closed.

## If you ship something cool

If your fork serves a region or community well, a link back is appreciated but not required. The canonical project has no affiliation with forks. Commercial use is not granted by this repository's license.

---

Before publishing a fork, review the [license](LICENSE), replace the Mohave County source catalog, and make clear that your version is independently maintained.
