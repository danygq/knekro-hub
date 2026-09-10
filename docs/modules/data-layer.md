---
module: data-layer
owner_area: backend
last_verified_against_commit: 864e93b
depends_on: []
---

# Data layer

Supabase Postgres accessed through PostgREST (`@supabase/supabase-js`). No ORM. See `docs/QUERY_OPTIMIZATION.md` before
writing queries.

## Clients

| Client | File | Key | Use |
|---|---|---|---|
| Per-request SSR client | `lib/db-client.ts` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth + data queries in page frontmatter & API routes |
| Browser client | `lib/db-client.ts` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Direct DB writes + reads from client `<script>` blocks |

The SSR client is created per request (not shared) so each call carries the user's cookies/JWT. The browser client is a
singleton using the publishable key — safe for the browser when RLS policies are in place. Both fall back to a valid
placeholder URL/key when env is absent so import-time `createClient` can't crash the page. Intentional — keep it.

## Env vars (already set in Vercel — do not re-add)

Referenced in `src/` (confirmed):
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `lib/db-client.ts` (both SSR + browser clients)

`.env.example` additionally declares `SUPABASE_SERVICE_ROLE_KEY` — server-only, never client. Other names (e.g.
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `POSTGRES_*`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`) appear in old
Supabase/Vercel docs but are **not referenced anywhere in `src/`** — unclear, verify before relying on them.

## Tables — CONFIRMED in code

| Table | Columns used | Where |
|---|---|---|
| `posts` | `id, title, excerpt, created_at` | `index.astro` (order `created_at` desc, limit 10) |
| `game_status` | `id, name` | `lib/games.ts` → `games/index.astro` (order `id`) |
| `games_user_votes` | `id, user_id, game_id, vote` | `lib/games.ts` (user votes) · `lib/client/games-vote.ts` (insert/update/clear) |

> **Prerequisite**: `games_user_votes` must exist in Supabase for the community-voting feature to work. Expected
> columns: `id` (PK), `user_id` (FK → auth.users), `game_id` (FK → games), `vote` (integer, nullable). A null `vote`
> means the user cleared their vote (row is kept). Unique constraint on `(user_id, game_id)` required for upsert.

## Tables — INFERRED from `src/types/` (unclear — needs confirmation against Supabase)

- `games` — **already queried by `/games`** (`loadGamesLibrary`, `lib/games.ts`): selects
  `id, name, cover_url, vote_count, avg_vote` + embedded `status:game_status!game_status_id(id, name)` (FK column
  `game_status_id`, order `id`, limit 48). `vote_count`/`avg_vote` are maintained by the `on_vote_change` trigger
  (see below). Schema still unconfirmed against Supabase.
  > `GameListRow`/live query use `name` for the game title; the aspirational `Game` type uses `title` — reconcile
  > with the real column before building joins on it.
- `goty_items` — `GotyItem`: year, rank, game_id (FK→games), votes, tier, notes.
- `stream_logs` — `StreamLog`: title, started_at, ended_at, is_live, duration_seconds, vod_url, youtube_url.
- `categories` — `Category`: name, game_id, url (M:N with stream_logs likely).

> Type caveat: `src/types/*` marks ids as `number` while comments say "UUID or slug". Reconcile with actual column types
> before building queries/joins.

## Writes

`games_user_votes` is the only table written from `src/`:
- `lib/client/games-vote.ts` - inserts, updates, or clears a vote via the browser Supabase client (`upsert` on
  `user_id,game_id`). Authenticated via the synced SSR session (`setSession`); the `user_id` comes from the
  authenticated user, never from user input. A `vote` of `null` clears the vote (row kept, `vote` column set to null).
  After a successful write the same module re-fetches the community average for that game (`fetchCommunityAverage`)
  and updates the card — there is no optimistic average math in the UI.

## Community-vote averages & the `games` trigger

The community average + vote count shown on `/games` is **read from the `games` table**: `lib/games.ts`
(`loadGamesLibrary`) selects `vote_count, avg_vote` alongside the grid columns, and `buildCommunityAverages` maps
them per game. The `on_vote_change` trigger (function `update_game_vote_stats()`) keeps those columns in sync after
every INSERT/UPDATE/DELETE on `games_user_votes` — the app never aggregates votes itself.

The client reads the same columns after a vote too: `lib/client/games-vote.ts` (`fetchCommunityAverage`) queries
`games` for `vote_count, avg_vote` and updates the card. This requires an RLS policy allowing authenticated users to
SELECT `games` (the same policy the SSR page relies on).

Display format: whole numbers render as integers, otherwise max 1 decimal (e.g. `8` or `8.5`).

## Reads are server-side

All queries run in `.astro` frontmatter or API routes. Do not fetch from the client. Handle `error` defensively and
default to `[]` (existing pattern).
