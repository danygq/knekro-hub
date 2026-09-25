---
module: rankings
owner_area: product
last_verified_against_commit: 21df033
depends_on: [data-layer, query-optimization, routing-ui]
---

# Rankings — awards & classification module

**Status: confirmed & implemented (Issues #61, #91).**

## Purpose

A generalized awards and ranking system for Knekro Hub:

- Hub page at `/ranking` displays categories/tracks (`ranking_categories` table).
- Standalone category ranking pages:
  - `/ranking/goty` (`goty.astro`): Overall Game of the Year.
  - `/ranking/vuela-alto` (`vuela-alto.astro`): Games with "Vuela Alto" status (`status_id = 2`).
  - `/ranking/roguelike` (`roguelike.astro`): Games with any roguelike tag (`68, 250, 251, 252`, `tag_mode = any`).
  - `/ranking/terror` (`terror.astro`): Games with any terror tag (`289, 290`, `tag_mode = any`).
  - `/ranking/incremental` (`incremental.astro`): Games with incremental tag (`149`).
- User-scoped podium and ranking placement (`ranking_items` table with `user_id`).
- Safe redirects for backward compatibility:
  - `/rankings` &rarr; 308 redirect to `/ranking`

## Data Model (confirmed)

### Tables

| Table                | Purpose                                                    | Key columns                                                                                                    |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ranking_categories` | Award categories / tracks                                  | `id, name, slug (UNIQUE), description, cover_url, created_at`                                                  |
| `ranking_items`      | User-scoped ranked game placement in a category for a year | `id, user_id (FK→auth.users), year, category_id (FK→ranking_categories), game_id (FK→games), rank, created_at` |

### Constraints

- `ranking_categories`:
  - `PRIMARY KEY (id)`
  - `UNIQUE (slug)`
- `ranking_items`:
  - `PRIMARY KEY (id)`
  - `UNIQUE (user_id, year, category_id, game_id)` — prevents duplicate games in the same user ranking category
  - `UNIQUE (user_id, year, category_id, rank)` — prevents duplicate podium slot assignment
  - `CHECK (rank >= 1)`
  - `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`
  - `FOREIGN KEY (category_id) REFERENCES ranking_categories(id) ON DELETE CASCADE`
  - `FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE`

### Indexes

- `idx_ranking_items_user_id` on `ranking_items(user_id)`
- `idx_ranking_items_category_id` on `ranking_items(category_id)`
- `idx_ranking_items_game_id` on `ranking_items(game_id)`
- `idx_ranking_items_user_year_cat_rank` on `ranking_items(user_id, year, category_id, rank)`

### Row Level Security (RLS)

- **`ranking_categories`**:
  - `SELECT`: `authenticated` users (`USING (true)`).
  - `INSERT`, `UPDATE`, `DELETE`: Owner-only mutations using `public.is_owner()`.
- **`ranking_items`**:
  - `SELECT`: `user_id = (select auth.uid()) OR is_owner()`
  - `INSERT`: `user_id = (select auth.uid())`
  - `UPDATE`: `user_id = (select auth.uid())`
  - `DELETE`: `user_id = (select auth.uid())`

## Typical Reads and Mutations

```ts
// 1. Categories for hub panels
const { data: categories } = await supabase
  .from("ranking_categories")
  .select("id, name, slug, description, cover_url, created_at")
  .order("id", { ascending: true });

// 2. Podium items for a category, year, and user
const { data: podium } = await supabase
  .from("ranking_items")
  .select(
    "id, user_id, year, category_id, game_id, rank, game:games!game_id(id, name, cover_url, avg_vote, vote_count, status:game_status!game_status_id(id, name))",
  )
  .eq("category_id", categoryId)
  .eq("year", year)
  .eq("user_id", userId)
  .in("rank", [1, 2, 3])
  .order("rank", { ascending: true });

// 3. Assign or swap podium slot
await assignPodiumGame(supabase, {
  categoryId,
  gameId,
  rank,
  year,
  userId,
});
```

## Search Query Architecture (unified, Issue #65)

`loadRankingSearchGames` in `src/lib/ranking.ts` delegates to `fetchGames` from
`src/lib/games.ts`, which executes a single `get_user_games` Postgres RPC call.

This eliminates the previous two-stage waterfall (a `head: true` count query
followed by a range select) and aligns ranking search with the `/games` catalog
pattern. Both surfaces now share one database round trip per search keystroke,
reducing network latency by ~50%.

Parameters passed through:

| Param       | Source in `/api/ranking/search.astro` | Notes                                     |
| ----------- | ------------------------------------- | ----------------------------------------- |
| `query`     | `?q=` (trimmed)                       | Empty string = no filter                  |
| `offset`    | `?offset=` (`Math.max(0, ...)`)       | Clamped to ≥ 0                            |
| `limit`     | `?limit=` (1–48)                      | Clamped by `Math.min(48, Math.max(1, …))` |
| `sort`      | hardcoded `"name_asc"`                | Consistent alphabetical ordering          |
| `status_id` | `?status_id=` (multiple)              | Filter game pool to specific status IDs   |
| `tag_id`    | `?tag_id=` (multiple)                 | Filter game pool to specific tag IDs      |
| `tag_mode`  | `?tag_mode=` (`'and'` \| `'any'`)     | Matching logic: `'any'` (OR) or `'and'`   |
