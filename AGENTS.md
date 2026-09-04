# The Cacti public repository instructions

These instructions apply to the entire repository.

## Scope and authority

This is the public, source-available distribution repository for The Cacti. It provides the complete locally runnable source, a portable production runtime, and a separate static showroom.

Treat this repository as self-contained. A private or development checkout may exist beside it. Do not inspect, copy from, synchronize with, or modify any sibling repository unless James explicitly includes it in the task. Do not operate on a live deployment or hosted showroom unless James explicitly requests that exact action.

Before editing, run `git status --short --branch`. Preserve changes you did not create. Ignored directories can contain local data and verification artifacts; do not delete them as cleanup.

Authority order:

1. James's current request.
2. This file.
3. `START_HERE.md` for current project state and orientation.
4. `package.json`, the lockfile, and source behavior.
5. `README.md`, `RUNTIME.md`, and `docs/CONFIGURATION.md`.

When documentation and code disagree, verify actual behavior and update the documentation with the same change.

## Source map

- `client/` — React and Vite interface; routes are registered in `client/src/App.tsx`.
- `server/` — Express and tRPC application, authentication, ingestion, scheduling, alerts, reports, and model providers.
- `server/_core/index.ts` — development entry using Vite middleware.
- `server/_core/production.ts` — production entry serving built static files.
- `server/_core/server.ts` — shared HTTP-server initialization.
- `server/routers.ts` and `server/routers/` — server API surface.
- `server/_core/trpc.ts` — server-enforced public, signed-in, and owner authorization.
- `drizzle/schema.ts` — application database schema.
- `drizzle/migrations/` — ordered runtime SQLite migrations.
- `server/db.ts` — sql.js-backed, single-process SQLite persistence.
- `config/data-sources.json` — default Mohave County source catalog.
- `shared/region.ts` — shared regional values.
- `.env.example`, `server/_core/env.ts`, and `docs/CONFIGURATION.md` — configuration contract.
- `package.json` — commands, version, dependency boundary, and runtime file allowlist.
- `pnpm-lock.yaml` — reproducible dependency resolution.

## Preserve both execution modes

The normal application uses Express, tRPC, SQLite, authentication, configured public sources, and optional external providers.

The showroom is a browser-only static demonstration:

- `pnpm build:showroom` sets `VITE_SHOWROOM_MODE=1` and writes `dist/showroom/`.
- `client/src/main.tsx` replaces the network tRPC link with `client/src/lib/demoLink.ts`.
- `client/src/hooks/useSSE.ts` must not open an SSE connection in showroom mode.
- Showroom records must remain fictional, deterministic, and clearly labeled.
- The showroom must not call the application API, authentication services, public source websites, model providers, email providers, analytics, or other external origins.
- Do not replace the showroom adapter with a live backend or real credentials.
- Serve `dist/showroom/` with SPA fallback to `index.html`; opening the file directly or using a server without fallback is not valid verification.

Changes to shared client code must be checked in both modes.

## Security and data rules

- Never commit or print `.env`, API keys, OAuth credentials, cookies, personal data, SQLite databases, or `data/settings.json`.
- Preserve ignored `data/` contents. Use an isolated temporary runtime tree and database for smoke tests.
- Do not stage `node_modules/`, `dist/`, `.release/`, or other generated output.
- UI visibility is not authorization. Sensitive operations must use `protectedProcedure` or `adminProcedure` on the server.
- Preserve the public, invited, and owner access model unless James explicitly changes it.
- The ingestion schedule is disabled on first run. Do not enable collection, model calls, or email delivery by default.
- Do not rewrite an applied migration. Add a new ordered migration and keep `drizzle/schema.ts` consistent.
- Preserve the PolyForm Noncommercial license and existing ownership notice unless James explicitly directs a legal or ownership change.

## Verification floor

For code, dependency, schema, or build changes, run:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Smoke-test the production build from an isolated directory with an unused port and fresh database. Verify `/api/health`, `/about`, one built asset, and automatic migrations.

Serve the showroom with `pnpm preview:showroom`. Exercise every route registered in `client/src/App.tsx` and use browser network inspection to confirm there are no `/api/` or external-origin requests.

For release-packaging changes, also run `pnpm release:stage` and inspect the staged allowlist. Create and hash the archive as a separate step, extract it into a different path, launch it through `run.bat` or `run.sh`, and repeat the runtime checks.

Finish with:

```bash
git diff HEAD --check
git status --short
```

There is no automated unit-test, integration-test, lint, or CI command. Report exactly what ran. Documentation-only changes require link/content review and `git diff HEAD --check`; they do not require rebuilding unchanged code.

## Remote actions

Do not deploy, create or replace releases, create tags, force-push, rewrite history, delete branches, or modify hosted infrastructure unless the current request explicitly authorizes that action.

Before an authorized push or release, fetch the remote, verify divergence, confirm the intended version and commit, and verify asset names and checksums. Never reuse an existing release tag for different bytes.

## Known limits

- A fresh installation contains no collected records.
- Google sign-in, generated analysis, and email alerts require external credentials.
- The default source catalog is incomplete, and source websites can break individual RSS or webpage adapters.
- Editing `config/data-sources.json` changes future seed operations; it does not rewrite existing database rows.
- The sql.js database implementation is intended for a local, single-process installation. Do not assume multi-process or horizontally scaled safety.
- OAuth redirect configuration must match `PUBLIC_URL` and the actual port.
- Runtime paths are working-directory-relative.
- The static showroom requires SPA fallback.
- The hosted showroom is outside local verification scope unless explicitly requested.
