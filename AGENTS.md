---
module: agent-onboarding
owner_area: repo-wide
last_verified_against_commit: 249b663
depends_on: [ARCHITECTURE.md, docs/INDEX.md]
---

# AGENTS.md — read this first

Onboarding contract for any AI agent working in `knekro-hub`. Load this + `ARCHITECTURE.md` before editing. Always
review the [`.agents/skills/`](.agents/skills/) directory (e.g. [`agentmemory.md`](.agents/skills/agentmemory.md)) for
local protocols and tools whenever handling inquiries or tasks. For deep dives, grep `docs/` front-matter (`module`,
`depends_on`) and pull only the 1–2 files you need — do not load the whole doc set.

## What this repo is

Astro SSR site (a "hub") for the Twitch streamer **Knekro**: a library of games played on stream + a separate **GOTY**
awards section. Supabase = data + auth. Vercel = deploy. See `ARCHITECTURE.md`.

## Agent Skills & Local Protocols (`.agents/skills/`)

Always inspect the [`.agents/skills/`](.agents/skills/) folder before executing tasks or responding to repository
inquiries:

- **[`agentmemory.md`](.agents/skills/agentmemory.md)**: Lifecycle skill for token-efficient memory using the
  `agentmemory` MCP server. Always perform `memory_recall` at task/session start and persist learnings/decisions with
  `memory_save` or `memory_lesson_save` upon completion.
- Review and apply any other task-specific skills located in `.agents/skills/`.

## Golden rules

- **Do not connect/create a database or new Supabase project.** Supabase already exists and is managed externally; env
  vars are already set in Vercel. Never scaffold auth or DB from scratch.
- **Never `select("*")` in Supabase queries.** Name columns. See `docs/QUERY_OPTIMIZATION.md` — this is a hard project
  requirement.
- **Never commit secrets.** Only `PUBLIC_*` keys are client-safe. Service role key is server-only.
- **Format before commit.** Always run `npx prettier --write <file>` on every file pending to commit before committing, ensuring all staged changes are formatted.
- **Branch/commit naming:** use `docs/…`, `feat/…`, `fix/…`. **Do not use `v0/…`.** Follow conventions in [
  `docs/AGENT_PROTOCOL.md`](docs/AGENT_PROTOCOL.md).
- **No new deps without reason.** Check `package.json` first; the stack is deliberately small.
- **Don't hallucinate schema.** `posts` and `game_status` are confirmed; `games` is now queried by `/games` (see
  `docs/modules/data-layer.md`) but its schema is still unconfirmed. Anything else is inferred — verify against Supabase
  before relying on it. Mark unknowns "unclear — needs confirmation".

## Development workflow

Follow the model-agnostic protocol in [`docs/AGENT_PROTOCOL.md`](docs/AGENT_PROTOCOL.md) when creating issues, naming
branches, writing commit messages, opening pull requests, and executing tasks. Remember: strictly no checkboxes on
issues or PRs (use clean bullet points), and issues must always include concrete technical implementation details.
Apply a level of rigor proportional to the task's complexity; complex features require thorough architectural
assessment, while simple fixes can be implemented directly.

## Conventions

| Topic      | Rule                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language   | TypeScript, `.astro` components                                                                                                                                                                           |
| Imports    | Relative paths (no tsconfig/aliases)                                                                                                                                                                      |
| Styling    | Tailwind v4 utilities + all CSS in `src/styles/` (single folder: `global.css` entry importing `tokens.css`/`base.css`/`utilities.css`; per-page files in `src/styles/pages/*.css`). No `tailwind.config`. |
| UI copy    | Spanish (`lang="es"`)                                                                                                                                                                                     |
| Icons      | Prefer `@lucide/astro` components (e.g. `<Search class="size-4" />`); use inline SVG only for brand assets (`TwitchLogo.astro`)                                                                           |
| Data reads | Server-side only: `.astro` frontmatter / API routes, or server libs those import (e.g. `lib/games.ts`)                                                                                                    |
| Auth       | Supabase Twitch OAuth via `@supabase/ssr` cookie clients                                                                                                                                                  |

## Where NOT to make changes

- `src/lib/db-client.ts` placeholder-fallback pattern exists on purpose (keeps pages rendering while env provisions) —
  don't "fix" it away.
- Env var names — they are wired in Vercel; renaming breaks deploy.

## Run / verify

```bash
pnpm install
pnpm run dev      # astro dev
pnpm run build    # astro build (SSR, vercel adapter)
pnpm run preview
npx prettier --write <files...> # format pending files before commit
```

No test suite exists. Verify changes by building + loading the affected route.

## Docs freshness (checklist — do this before finishing any change)

Docs are snapshots pinned to `last_verified_against_commit` (see `docs/DOC_COVERAGE.md`). Keep them in sync:

- Did the change touch a documented area? (routes/pages, `Layout`, components, theming/`src/styles`, Supabase
  clients/env, auth flow, DB tables/queries, or new libs/modules) → check the matching file in `docs/` +
  `ARCHITECTURE.md` +
  `AGENTS.md`.
- If yes: update the doc + **propose a `docs/…` branch** with the suggested changes; don't silently ship doc drift.
- Bump `last_verified_against_commit` in any doc you re-verify to the current `HEAD` commit hash.
- If the change was small/self-contained, include the doc edit in the same branch; otherwise split `docs/…` from the
  feature branch.
- Never claim a schema/table as confirmed unless it appears in live queries (rule: don't hallucinate schema).

## Open work (status)

`/games` is wired to Supabase (`games` + `game_status`) via `lib/games.ts`; `/ranking` and `/ranking/goty` are wired to Supabase (`ranking_categories` + `ranking_items`) via `lib/ranking.ts` (see `docs/modules/rankings.md`).
