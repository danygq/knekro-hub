---
module: data-layer
owner_area: backend
last_verified_against_commit: 56bdfc6
depends_on: []
---

# Data layer

Supabase Postgres accessed through PostgREST (`@supabase/supabase-js`). No ORM. See `docs/QUERY_OPTIMIZATION.md` before
writing queries.

## Clients

| Client            | File                                                | Key                               | Use                              |
|-------------------|-----------------------------------------------------|-----------------------------------|----------------------------------|
| Browser client    | `lib/supabase.ts`                                   | `PUBLIC_SUPABASE_ANON_KEY`        | Public reads in page frontmatter |
| SSR cookie client | inline in `Layout` + `api/auth/*` + `auth/callback` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth/session                     |

Both fall back to a valid placeholder URL/key when env is absent so import-time `createClient` can't crash the page.
Intentional — keep it.

> Inconsistency to resolve: anon vs publishable key across clients. Pick one project-wide.

## Env vars (already set in Vercel — do not re-add)

Referenced in `src/` (confirmed):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — `lib/supabase.ts` (browser client)
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — SSR cookie clients in `Layout` + `api/auth/*` + `auth/callback`

`.env.example` additionally declares `SUPABASE_SERVICE_ROLE_KEY` — server-only, never client. Other names (e.g.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `POSTGRES_*`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`) appear in old
Supabase/Vercel docs but are **not referenced anywhere in `src/`** — unclear, verify before relying on them.

## Tables — CONFIRMED in code

| Table         | Columns used                     | Where                                             |
|---------------|----------------------------------|---------------------------------------------------|
| `posts`       | `id, title, excerpt, created_at` | `index.astro` (order `created_at` desc, limit 10) |
| `game_status` | `id, name`                       | `lib/games.ts` → `games/index.astro` (order `id`) |

## Tables — INFERRED from `src/types/` (unclear — needs confirmation against Supabase)

- `games` — **already queried by `/games`** (`loadGamesLibrary`, `lib/games.ts`): selects
  `id, name, cover_url` + embedded `status:game_status!game_status_id(id, name)` (FK column `game_status_id`,
  order `id`, limit 48). Schema still unconfirmed against Supabase.
  > `GameListRow`/live query use `name` for the game title; the aspirational `Game` type uses `title` — reconcile
  > with the real column before building joins on it.
- `goty_items` — `GotyItem`: year, rank, game_id (FK→games), votes, tier, notes.
- `stream_logs` — `StreamLog`: title, started_at, ended_at, is_live, duration_seconds, vod_url, youtube_url.
- `categories` — `Category`: name, game_id, url (M:N with stream_logs likely).

> Type caveat: `src/types/*` marks ids as `number` while comments say "UUID or slug". Reconcile with actual column types
> before building queries/joins.

## Reads are server-side

All queries run in `.astro` frontmatter or API routes. Do not fetch from the client. Handle `error` defensively and
default to `[]` (existing pattern).
