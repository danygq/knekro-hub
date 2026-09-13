---
module: doc-coverage
owner_area: repo-wide
last_verified_against_commit: fc4b86e
depends_on: []
---

# Doc coverage

Cross-checked against source at commit `fc4b86e`.

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

- Tables `posts`, `game_status`, `games`, `games_user_votes`: **verified** — full DDL confirmed and documented in
  `docs/modules/data-layer.md` → "Database schema (confirmed)".
- Component suite under `src/components/games/` (`GamesLayout`, `GamesFilterMenu`, `GameSearch`, `GameCard`,
  `GameCover`, badges, and vote overlay components) and Alpine stores (`store.ts`): **verified** against implementation.
- API endpoints: `POST /api/games/vote.astro` and `GET /api/games/search.astro` (HTMX responses with OOB swaps):
  **verified** against implementation.
- Column lists for `posts`: verified from `.select()` args only; other columns may exist (unclear).
- Tables `goty_items`, `stream_logs`, `categories`, `award_categories`: **inferred** from `src/types/` +
  product intent. Not confirmed against the Supabase schema — confirm before building on them.
- Indexes: `games_user_votes_game_id_idx` is confirmed from DDL; other suggested indexes are **inferred**
  from documented access patterns — validate with `EXPLAIN ANALYZE`.

## Could not verify (needs confirmation)

- RLS policies — not included in the DDL; verify before assuming access patterns.
- Whether `/posts/[id]` route is planned (linked but absent).
- GOTY voting model (community vs editorial) and tier-list persistence.

## Keeping docs fresh

Bump `last_verified_against_commit` in a file's front-matter when you re-verify it. If a module's source changed after
that commit, treat its doc as stale until re-checked.
