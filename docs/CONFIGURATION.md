# Configuration

The Cacti is configured through two layers:

1. **`.env` file** at the project root (loaded at startup, used as the fallback / default).
2. **Settings UI** at `/settings` in the running app (stored in `data/settings.json`, takes precedence at runtime).

You can use either. The Settings UI is the recommended path because changes apply without restart.

---

## LLM providers

The Cacti supports three LLM providers behind a single internal interface. Configure as many as you want, then pick the active one in Settings.

### Provider order

| Order | Provider | Default model | Console |
|-------|----------|---------------|---------|
| 1 (default) | Google Gemini | `gemini-2.5-flash` | https://aistudio.google.com/app/apikey |
| 2 | OpenAI | `gpt-4o-mini` | https://platform.openai.com/api-keys |
| 3 | DeepSeek | `deepseek-v4-flash` | https://platform.deepseek.com/api_keys |

### Switching providers at runtime

Open `/settings`. The **LLM Configuration** card has:

- **Active Provider** dropdown — choose which provider handles all LLM calls right now.
- **Per-provider tabs** — paste your API key, pick a model (preset suggestions or any custom slug your account supports), and **Test connection** to verify.
- **Rate limiting** — optional throttle (requests/sec) applied to whichever provider is active.

Settings changes invalidate the LLM provider singleton, so the next request picks them up immediately.

### Custom model slugs

The model field accepts any slug your provider account supports — not just the suggestions in the dropdown. Useful when a provider releases a new model before this app's defaults are updated.

---

## Environment variables

Documented in [`.env.example`](../.env.example). Summary:

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Standard Node env flag |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/app.db` | SQLite file location |
| `LLM_PROVIDER` | (unset) | Active provider fallback if Settings unset |
| `GEMINI_API_KEY` | — | Gemini key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `OPENAI_API_KEY` | — | OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `DEEPSEEK_API_KEY` | — | DeepSeek key |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek model |

The Settings UI overrides any of these at runtime.

---

## Data sources

Default scrape/RSS sources live in [`config/data-sources.json`](../config/data-sources.json) and are seeded on first run. Add or remove sources directly in the JSON file (server reload required) or via the Ingestion page in the UI.

---

## Storage layout

```
data/
  app.db              SQLite (Drizzle) — users, sources, alerts, reports, etc.
  settings.json       Settings UI persistence (API keys, model picks, rate-limit)
```

`data/` is gitignored. To reset the app to a fresh state, delete it.
