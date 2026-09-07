---
module: doc-coverage
owner_area: repo-wide
last_verified_against_commit: 8473325
depends_on: []
---

# Doc coverage

Cross-checked against source at commit `8473325`.

| Area                          | Documented? | Doc file                     | Confidence                            |
|-------------------------------|-------------|------------------------------|---------------------------------------|
| System architecture           | Yes         | `ARCHITECTURE.md`            | verified                              |
| Agent onboarding/conventions  | Yes         | `AGENTS.md`                  | verified                              |
| Routing + pages               | Yes         | `docs/modules/routing-ui.md` | verified                              |
| Layout / components / theming | Yes         | `docs/modules/routing-ui.md` | verified                              |
| Auth (Twitch OAuth, SSR)      | Yes         | `docs/modules/auth.md`       | verified                              |
| Supabase clients + env        | Yes         | `docs/modules/data-layer.md` | verified                              |
| Query/join/index rules        | Yes         | `docs/QUERY_OPTIMIZATION.md` | verified (rules) / inferred (indexes) |
| GOTY design                   | Yes         | `docs/GOTY.md`               | inferred (feature unbuilt)            |
| Domain terms                  | Yes         | `docs/GLOSSARY.md`           | verified                              |
| Decisions                     | Yes         | `docs/adr/*`                 | inferred                              |

## Verified vs code

- Tables `posts`, `game_status`: **verified** — appear in live queries.
- Column lists for `posts`/`game_status`: verified from `.select()` args only; other columns may exist (unclear).
- Tables `games`, `goty_items`, `stream_logs`, `categories`, `award_categories`: **inferred** from `src/types/` +
  product intent. Not confirmed against the Supabase schema — confirm before building on them.
- Suggested indexes: **inferred** from documented access patterns; validate with `EXPLAIN ANALYZE`.

## Could not verify (needs confirmation)

- Actual Supabase schema (column types, FKs, RLS policies) — not read; agent was instructed not to touch the DB
  connection.
- Whether `/posts/[id]` route is planned (linked but absent).
- GOTY voting model (community vs editorial) and tier-list persistence.

## Keeping docs fresh

Bump `last_verified_against_commit` in a file's front-matter when you re-verify it. If a module's source changed after
that commit, treat its doc as stale until re-checked.
