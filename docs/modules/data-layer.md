---
module: data-layer
owner_area: backend
last_verified_against_commit: 30ebd45
depends_on: []
---

# Data layer

Supabase Postgres accessed through PostgREST (`@supabase/supabase-js`). No ORM. See `docs/QUERY_OPTIMIZATION.md` before
writing queries.

## Clients

| Client | File | Key | Use |
|---|---|---|---|
| Per-request SSR client | `lib/db-client.ts` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth + data queries in page frontmatter & API routes |

Created per request (not shared) so each call carries the user's cookies/JWT. Falls back to a valid placeholder URL/key when env is absent so import-time `createClient` can't crash the page. Intentional — keep it.

## Env vars (already set in Vercel — do not re-add)

Referenced in `src/` (confirmed):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `lib/db-client.ts` (per-request SSR client)

`.env.example` additionally declares `SUPABASE_SERVICE_ROLE_KEY` — server-only, never client. Other names (e.g.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `POSTGRES_*`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`) appear in old
Supabase/Vercel docs but are **not referenced anywhere in `src/`** — unclear, verify before relying on them.

## Tables — CONFIRMED in code

| Table | Columns used | Where |
|---|---|---|
| `posts` | `id, title, excerpt, created_at` | `index.astro` (order `created_at` desc, limit 10) |
| `game_status` | `id, name` | `lib/games.ts` → `games/index.astro` (order `id`) |
| `games_user_votes` | `id, user_id, game_id, vote` | `lib/games.ts` (averages + user votes) · `pages/api/games/vote.ts` (insert/update/clear) |

> **Prerequisite**: `games_user_votes` must exist in Supabase for the community-voting feature to work. Expected
> columns: `id` (PK), `user_id` (FK → auth.users), `game_id` (FK → games), `vote` (integer, nullable). A null `vote`
> means the user cleared their vote (row is kept). Unique constraint on `(user_id, game_id)` recommended.

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

## Writes

`games_user_votes` is the only table written from `src/`:
- `POST /api/games/vote` (`pages/api/games/vote.ts`) — inserts, updates, or clears a vote. Authenticated via the SSR
  cookie client (`getUser`); the `user_id` always comes from the session, never the request body. A `vote` of `null`
  clears the vote (row kept, `vote` column set to null). An existing row for `(user_id, game_id)` is updated in place
  rather than duplicated.

## Reads are server-side

All queries run in `.astro` frontmatter or API routes. Do not fetch from the client. Handle `error` defensively and
default to `[]` (existing pattern).
