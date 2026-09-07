---
module: data-layer
owner_area: backend
last_verified_against_commit: 8473325
depends_on: []
---

# Data layer

Supabase Postgres accessed through PostgREST (`@supabase/supabase-js`). No ORM. See `docs/QUERY_OPTIMIZATION.md` before writing queries.

## Clients
| Client | File | Key | Use |
|---|---|---|---|
| Browser client | `lib/supabase.ts` | `PUBLIC_SUPABASE_ANON_KEY` | Public reads in page frontmatter |
| SSR cookie client | inline in `Layout` + `api/auth/*` + `auth/callback` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth/session |

Both fall back to a valid placeholder URL/key when env is absent so import-time `createClient` can't crash the page. Intentional — keep it.

> Inconsistency to resolve: anon vs publishable key across clients. Pick one project-wide.

## Env vars (already set in Vercel — do not re-add)
`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `POSTGRES_HOST/USER/DATABASE`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`. Service role key (`.env.example`) is server-only, never client.

## Tables — CONFIRMED in code
| Table | Columns used | Where |
|---|---|---|
| `posts` | `id, title, excerpt, created_at` | `index.astro` (order `created_at` desc, limit 10) |
| `game_status` | `id, name` | `games/index.astro` (order `id`) |

## Tables — INFERRED from `src/types/` (unclear — needs confirmation against Supabase)
- `games` — `Game`: title, slug, description, cover_url, platforms[], status(FK→game_status), play_count, tags[], timestamps.
- `goty_items` — `GotyItem`: year, rank, game_id(FK→games), votes, tier, notes.
- `stream_logs` — `StreamLog`: title, started_at, ended_at, is_live, duration_seconds, vod_url, youtube_url.
- `categories` — `Category`: name, game_id, url (M:N with stream_logs likely).

> Type caveat: `src/types/*` marks ids as `number` while comments say "UUID or slug". Reconcile with actual column types before building queries/joins.

## Reads are server-side
All queries run in `.astro` frontmatter or API routes. Do not fetch from the client. Handle `error` defensively and default to `[]` (existing pattern).
