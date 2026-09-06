# Start here

This is the public distribution repository for The Cacti, a locally runnable Mohave County public-record and regional-news workspace.

If you are an AI or coding agent, read these files before changing anything:

1. `AGENTS.md` — repository boundaries, invariants, and required verification.
2. `README.md` — public purpose, setup, layout, and known limits.
3. `package.json` — exact commands, dependency boundary, version, and runtime file allowlist.
4. `RUNTIME.md` — behavior of the portable runtime.
5. `docs/CONFIGURATION.md` — environment variables and local storage.

Then establish current state:

```bash
git status --short --branch
git log -1 --oneline
git fetch origin
git rev-list --left-right --count HEAD...origin/main
```

Work only in this repository. Do not inspect or modify a sibling private checkout, delete ignored local state, connect the showroom to live services, or operate on a hosted deployment unless James explicitly asks.

## Current baseline

The published prerelease is [`v0.1.0-beta.1`](https://github.com/anitacigawet/The-Cacti/releases/tag/v0.1.0-beta.1), built from commit `6645035b3c3f85f38bb485a19c7e8250bee5fa16`.

Published assets:

- `The-Cacti-v0.1.0-beta.1-runtime.zip`
  - SHA-256: `997e23ccca50625c19b620d4ce6ed064a985ed902c183943b5739356a0d7f28b`
- `The-Cacti-v0.1.0-beta.1-showroom.zip`
  - SHA-256: `96da2bf2f1c367fb69773a07264f75e21bf28c4ce87f0779db64ddad290882cf`
- `SHA256SUMS.txt`

The source tree, portable runtime, and static showroom are separate deliverables. The runtime ZIP contains the built server, built client, migrations, configuration, launchers, documentation, and production packages. The showroom ZIP is a static browser-only demonstration.

The source was updated after manual code and security review on 2026-09-06. These updates are not included in the existing prerelease ZIPs.

## Architecture at a glance

- `client/src/main.tsx` selects either the normal HTTP tRPC link or the deterministic showroom adapter.
- `client/src/App.tsx` defines browser routes.
- `client/src/lib/demoLink.ts` contains fictional showroom records and in-browser procedure responses.
- `client/src/hooks/useSSE.ts` disables server-sent events in showroom mode.
- `server/_core/index.ts` is the development entry point with Vite middleware.
- `server/_core/production.ts` is the production entry point with built static files.
- `server/_core/server.ts` initializes SQLite, Express, authentication, SSE, tRPC, static assets, and the scheduler.
- `server/routers.ts` is the tRPC router index; `server/routers/` contains feature routers.
- `server/_core/trpc.ts` enforces anonymous, signed-in, and owner procedure boundaries.
- `drizzle/schema.ts` and `drizzle/migrations/` define the SQLite data model and ordered migrations.
- `config/data-sources.json` is the default source catalog.

The normal application may contact configured public sources, Google OAuth, an enabled model provider, and Resend. The showroom must not contact any of them.

Runtime paths are resolved from the current working directory. Run development and production commands from the repository root, and run a packaged runtime from the extracted runtime root.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm verify
pnpm start
pnpm preview:showroom
pnpm release:stage
```

- `pnpm dev` starts the development server.
- `pnpm verify` runs type checking, isolated regression tests, the production build, and the showroom build.
- `pnpm start` requires a completed production build.
- `pnpm preview:showroom` requires a completed showroom build and serves it with SPA fallback.
- `pnpm release:stage` creates the portable production tree under `.release/runtime/`.

`pnpm test` runs the regression suite with temporary databases and mocked external services. It must not use existing runtime data or credentials. There is no lint or CI command. Report the checks actually run; automated tests are not a security certification.

`release:stage` does not create ZIPs or checksums. Archive creation, hashing, upload, hosted-download comparison, and tag verification remain explicit release steps. Do not publish, retag, or replace release assets without James's authorization.

## Local state

`node_modules/`, `dist/`, `.release/`, `.env`, and `data/` are ignored and noncanonical. They may contain dependencies, builds, release proofs, credentials, provider settings, or SQLite data. Do not include them in broad source searches, treat them as project authority, stage them, or delete them as cleanup.

There is no active task ledger or decision log. Follow the task supplied with the handoff; if none was supplied, ask James what specific work to perform. Do not infer unfinished work from generated files or old artifacts.
