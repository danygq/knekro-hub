---
module: agent-onboarding
owner_area: repo-wide
last_verified_against_commit: 8473325
depends_on: [ARCHITECTURE.md, docs/INDEX.md]
---

# AGENTS.md — read this first

Onboarding contract for any AI agent working in `knekro-hub`. Load this + `ARCHITECTURE.md` before editing. For deep dives, grep `docs/` front-matter (`module`, `depends_on`) and pull only the 1–2 files you need — do not load the whole doc set.

## What this repo is
Astro SSR site (a "hub") for the Twitch streamer **Knekro**: a library of games played on stream + a separate **GOTY** awards section. Supabase = data + auth. Vercel = deploy. See `ARCHITECTURE.md`.

## Golden rules
- **Do not connect/create a database or new Supabase project.** Supabase already exists and is managed externally; env vars are already set in Vercel. Never scaffold auth or DB from scratch.
- **Never `select("*")` in Supabase queries.** Name columns. See `docs/QUERY_OPTIMIZATION.md` — this is a hard project requirement.
- **Never commit secrets.** Only `PUBLIC_*` keys are client-safe. Service role key is server-only.
- **Branch/commit naming:** use `docs/…`, `feat/…`, `fix/…`. **Do not use `v0/…`.**
- **No new deps without reason.** Check `package.json` first; the stack is deliberately small.
- **Don't hallucinate schema.** Only `posts` and `game_status` are confirmed in code. Anything else is inferred — verify against Supabase before relying on it. Mark unknowns "unclear — needs confirmation".

## Conventions
| Topic | Rule |
|---|---|
| Language | TypeScript, `.astro` components |
| Imports | Relative paths (no tsconfig/aliases) |
| Styling | Tailwind v4 utilities + `--knk-*` CSS vars in `src/styles/global.css`. No `tailwind.config`. |
| UI copy | Spanish (`lang="es"`) |
| Icons | `lucide-astro`, or inline SVG matching existing stroke style |
| Data reads | Server-side in `.astro` frontmatter or API routes only |
| Auth | Supabase Twitch OAuth via `@supabase/ssr` cookie clients |

## Where NOT to make changes
- `src/lib/supabase.ts` placeholder-fallback pattern exists on purpose (keeps pages rendering while env provisions) — don't "fix" it away.
- Env var names — they are wired in Vercel; renaming breaks deploy.

## Run / verify
```bash
npm install
npm run dev      # astro dev
npm run build    # astro build (SSR, vercel adapter)
npm run preview
```
No test suite exists. Verify changes by building + loading the affected route.

## Open work (status)
`/games` grid and `/goty` are placeholders not yet wired to data. See `docs/DOC_COVERAGE.md` and `docs/GOTY.md`.
