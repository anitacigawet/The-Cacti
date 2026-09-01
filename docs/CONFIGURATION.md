# Configuration

Server, storage, authentication, and notification settings come from `.env` at startup. The Settings page stores LLM provider, model, API-key, and rate-limit choices in `data/settings.json`; those LLM choices take precedence over their `.env` fallbacks without a restart.

## Environment variables

Copy `.env.example` to `.env` and set only the features you plan to use.

| Variable | Example default | Purpose |
|----------|-----------------|---------|
| `PORT` | `3002` | First HTTP port the server tries |
| `DATABASE_PATH` | `./data/app.db` | SQLite database file |
| `PUBLIC_URL` | `http://localhost:3002` | Base URL used for OAuth callbacks and secure-cookie behavior |
| `GOOGLE_OAUTH_CLIENT_ID` | — | Google OAuth web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | — | Google OAuth web client secret |
| `JWT_SECRET` | — | Secret used to sign login cookies |
| `OWNER_EMAIL` | — | Email promoted to owner on first sign-in |
| `RESEND_API_KEY` | — | Optional Resend key for email alerts |
| `RESEND_FROM_EMAIL` | — | Verified sender used for email alerts |
| `LLM_PROVIDER` | `gemini` | Provider fallback if Settings has no choice |
| `GEMINI_API_KEY` | — | Gemini key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `OPENAI_API_KEY` | — | OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `DEEPSEEK_API_KEY` | — | DeepSeek key |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek model |

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Rotating `JWT_SECRET` logs out existing users. When `PUBLIC_URL` begins with `https://`, authentication cookies are marked `Secure`; local `http://localhost` installations remain usable over HTTP.

## LLM providers

The Cacti supports Gemini, OpenAI, and DeepSeek behind one internal interface. Open `/settings` to choose the active provider, enter a key, set a model slug, test the connection, or apply a request-per-second limit. The model field accepts any slug available to your provider account.

## Data sources

The default source catalog is `config/data-sources.json`. The **seed sources** action in Data Monitor reads that file and adds the enabled entries to the database. You can then manage sources in the interface. Editing the JSON changes what future seed actions use; it does not rewrite existing database rows.

## Storage

```text
data/
  app.db          SQLite records, users, sources, alerts, and reports
  settings.json   LLM provider settings entered through the interface
```

`data/` and `.env` are ignored by Git. Keep both private and back up `data/` if you want to preserve an installation.
