---
module: goty
owner_area: product
last_verified_against_commit: HEAD
depends_on: [rankings, data-layer, query-optimization]
---

# GOTY — Game of the Year (Rankings)

**Status: confirmed & migrated (Issue #61).**

The GOTY awards section is now part of the generalized [**Rankings module**](modules/rankings.md).

## Routing

- Hub: [`/ranking`](../src/pages/ranking/index.astro)
- GOTY award track: [`/ranking/goty`](../src/pages/ranking/[slug].astro)
- Other tracks: `/ranking/[slug]` (e.g. `/ranking/vuela-alto`)
- Legacy routes `/goty` and `/goty/[slug]` permanently redirect (HTTP 308) to `/ranking/goty` and `/ranking/[slug]`.

## Data Model

Data has been migrated from legacy tables to:

- `ranking_categories` (e.g. `slug: "goty"`, `name: "Game of the Year"`)
- `ranking_items` (user-scoped placements with `user_id`)

See [docs/modules/rankings.md](modules/rankings.md) for full schema, indexes, and RLS documentation.
