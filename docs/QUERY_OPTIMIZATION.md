---
module: query-optimization
owner_area: backend
last_verified_against_commit: 30ebd45
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
// games list with status name + goty rank, one round-trip, scoped columns
const { data } = await supabase
  .from("games")
  .select("id, title, slug, cover_url, status:game_status(name), goty_items(year, rank, tier)")
  .order("updated_at", { ascending: false })
  .range(0, 23);
```

```ts
// filter by embedded FK (games in a status) — inner join semantics
supabase.from("games")
  .select("id, title, status:game_status!inner(name)")
  .eq("status.name", "En progreso");
```

When PostgREST needs a nudge (multiple FK paths, or to be explicit), name the FK in the embed — `/games` does this:
`status:game_status!game_status_id(id, name)`. Same result, no guessing.

Anti-pattern (N+1): fetching games, then a `game_status` query per row. Never.

## Indexes to create (match the access patterns above)

| Table         | Index                                               | Serves                             |
|---------------|-----------------------------------------------------|------------------------------------|
| `posts`       | `(created_at desc)`                                 | home feed order+limit              |
| `games`       | `(status_id)`, `(updated_at desc)`, `(slug) unique` | status filter, sort, detail lookup |
| `games_user_votes` | `(user_id, game_id)` unique                  | per-user lookup/upsert (votes); community averages live on `games.vote_count`/`avg_vote`, maintained by the `on_vote_change` trigger |
| `goty_items`  | `(year, rank)` composite, `(game_id)` FK            | year ranking, embed join           |
| `stream_logs` | `(started_at desc)`, `(is_live)` partial            | timeline, live lookup              |
| join table    | `(stream_log_id)`, `(category_id)`, unique pair     | M:N categories                     |

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
