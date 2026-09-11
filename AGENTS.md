---
module: agent-onboarding
owner_area: repo-wide
last_verified_against_commit: 3b1304b
depends_on: [ ARCHITECTURE.md, docs/INDEX.md ]
---

# AGENTS.md — read this first

Onboarding contract for any AI agent working in `knekro-hub`. Load this + `ARCHITECTURE.md` before editing. For deep
dives, grep `docs/` front-matter (`module`, `depends_on`) and pull only the 1–2 files you need — do not load the whole
doc set.

## What this repo is

Astro SSR site (a "hub") for the Twitch streamer **Knekro**: a library of games played on stream + a separate **GOTY**
awards section. Supabase = data + auth. Vercel = deploy. See `ARCHITECTURE.md`.

## Golden rules

- **Do not connect/create a database or new Supabase project.** Supabase already exists and is managed externally; env
  vars are already set in Vercel. Never scaffold auth or DB from scratch.
- **Never `select("*")` in Supabase queries.** Name columns. See `docs/QUERY_OPTIMIZATION.md` — this is a hard project
  requirement.
- **Never commit secrets.** Only `PUBLIC_*` keys are client-safe. Service role key is server-only.
- **Branch/commit naming:** use `docs/…`, `feat/…`, `fix/…`. **Do not use `v0/…`.**
- **No new deps without reason.** Check `package.json` first; the stack is deliberately small.
- **Don't hallucinate schema.** `posts` and `game_status` are confirmed; `games` is now queried by `/games` (see
  `docs/modules/data-layer.md`) but its schema is still unconfirmed. Anything else is inferred — verify against Supabase
  before relying on it. Mark unknowns "unclear — needs confirmation".

## Issue workflow

Follow the model-agnostic protocol in [`docs/AGENT_PROTOCOL.md`](docs/AGENT_PROTOCOL.md) when creating or executing
issues. Apply a level of rigor proportional to the task's complexity; complex features require thorough architectural
assessment, while simple fixes can be implemented directly.

## Conventions

| Topic      | Rule                                                                                                                                                                                                      |
|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Language   | TypeScript, `.astro` components                                                                                                                                                                           |
| Imports    | Relative paths (no tsconfig/aliases)                                                                                                                                                                      |
| Styling    | Tailwind v4 utilities + all CSS in `src/styles/` (single folder: `global.css` entry importing `tokens.css`/`base.css`/`utilities.css`; per-page files in `src/styles/pages/*.css`). No `tailwind.config`. |
| UI copy    | Spanish (`lang="es"`)                                                                                                                                                                                     |
| Icons      | `lucide-astro`, or inline SVG matching existing stroke style                                                                                                                                              |
| Data reads | Server-side only: `.astro` frontmatter / API routes, or server libs those import (e.g. `lib/games.ts`)                                                                                                    |
| Auth       | Supabase Twitch OAuth via `@supabase/ssr` cookie clients                                                                                                                                                  |

## Where NOT to make changes

- `src/lib/db-client.ts` placeholder-fallback pattern exists on purpose (keeps pages rendering while env provisions) —
  don't "fix" it away.
- Env var names — they are wired in Vercel; renaming breaks deploy.

## Run / verify

```bash
npm install
npm run dev      # astro dev
npm run build    # astro build (SSR, vercel adapter)
npm run preview
```

No test suite exists. Verify changes by building + loading the affected route.

## Docs freshness (checklist — do this before finishing any change)

Docs are snapshots pinned to `last_verified_against_commit` (see `docs/DOC_COVERAGE.md`). Keep them in sync:

- [ ] Did the change touch a documented area? (routes/pages, `Layout`, components, theming/`src/styles`, Supabase
  clients/env,
  auth flow, DB tables/queries, or new libs/modules) → check the matching file in `docs/` + `ARCHITECTURE.md` +
  `AGENTS.md`.
- [ ] If yes: update the doc + **propose a `docs/…` branch** with the suggested changes; don't silently ship doc drift.
- [ ] Bump `last_verified_against_commit` in any doc you re-verify to the current `HEAD` commit hash.
- [ ] If the change was small/self-contained, include the doc edit in the same branch; otherwise split `docs/…` from the
  feature branch.
- [ ] Never claim a schema/table as confirmed unless it appears in live queries (rule: don't hallucinate schema).

## Open work (status)

`/games` is wired to Supabase (`games` + `game_status`) via `lib/games.ts`; `/goty` remains a static placeholder (design
in `docs/GOTY.md`).
