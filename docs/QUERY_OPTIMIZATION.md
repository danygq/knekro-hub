---
module: query-optimization
owner_area: backend
last_verified_against_commit: f74e9ed
depends_on: [data-layer]
---

# Postgres / Supabase query rules

Hard requirement for this repo: every read is column-scoped, join-aware, and index-backed. Applies to all
`supabase.from(...)` calls.

## Rules (non-negotiable)

1. **Never `select("*")`.** Name exactly the columns the view uses. The `/games` loader in `lib/games.ts` is the
   reference implementation — match its shape.
2. **Join via PostgREST embedding, never N+1.** One request pulls related rows through FKs.
3. **Every filter/order/join column must be indexed** (FK columns are *not* auto-indexed in Postgres — add them).
4. **Bound every list** with `.limit()` or `.range()`. No unbounded reads.
5. **Order by an indexed column;** prefer keyset over large `OFFSET`.
6. `count:'exact'` only when the number is displayed — it costs a full scan; prefer `'planned'`/`'estimated'`.
7. Wrap RLS predicates as `(select auth.uid())` so the planner caches per-statement, and index columns used in policies.

## Embedding (joins) — do this

```ts
// games list with status name, one round-trip, scoped columns (confirmed schema)
const { data } = await supabase
  .from("games")
    .select("id, name, cover_url, avg_vote, vote_count, status:game_status!game_status_id(id, name)")
    .order("id", {ascending: true})
  .range(0, 23);
```

```ts
// filter by embedded FK (games in a status) — inner join semantics
supabase.from("games")
    .select("id, name, status:game_status!inner(name)")
  .eq("status.name", "En progreso");
```

When PostgREST needs a nudge (multiple FK paths, or to be explicit), name the FK in the embed — `/games` does this:
`status:game_status!game_status_id(id, name)`. Same result, no guessing.

Anti-pattern (N+1): fetching games, then a `game_status` query per row. Never.

## Indexes (confirmed + suggested)

### Confirmed (from DDL)

| Table              | Index                                                               | Serves                                      |
|--------------------|---------------------------------------------------------------------|---------------------------------------------|
| `game_status`      | `game_status_name_key` (unique on name)                             | uniqueness on status name                   |
| `games`            | `games_pkey` (PK on id)                                             | primary lookup                              |
| `games_user_votes` | `games_user_votes_user_id_game_id_key` (unique on user_id, game_id) | per-user lookup/upsert (votes)              |
| `games_user_votes` | `games_user_votes_game_id_idx` (btree on game_id)                   | trigger aggregation lookup on votes by game |

### Suggested (inferred from access patterns — validate with `EXPLAIN ANALYZE`)

| Table         | Index                                           | Serves                                                    |
|---------------|-------------------------------------------------|-----------------------------------------------------------|
| `posts`       | `(created_at desc)`                             | home feed order+limit                                     |
| `games`       | `(game_status_id)`                              | status filter (FK column is not auto-indexed in Postgres) |
| `goty_items`  | `(year, rank)` composite, `(game_id)` FK        | year ranking, embed join                                  |
| `stream_logs` | `(started_at desc)`, `(is_live)` partial        | timeline, live lookup                                     |
| join table    | `(stream_log_id)`, `(category_id)`, unique pair | M:N categories                                            |

Verify a query hits an index: `EXPLAIN ANALYZE` in Supabase SQL editor → expect `Index Scan`, not `Seq Scan`, on
filtered/sorted columns.

## Pagination

```ts
// keyset (preferred for deep pages): cursor = last created_at seen
supabase.from("posts")
  .select("id, title, excerpt, created_at")
  .lt("created_at", cursor)
  .order("created_at", { ascending: false })
  .limit(10);
```

## Single-row reads

Use `.maybeSingle()` (0-or-1, no throw) for lookups like `/posts/[id]`; `.single()` only when exactly one is guaranteed.

## Checklist before merging a query

- [ ] explicit columns - [ ] embedded joins not loops - [ ] indexed filter/order cols - [ ] bounded - [ ] `EXPLAIN`
  shows index scan - [ ] RLS-safe
