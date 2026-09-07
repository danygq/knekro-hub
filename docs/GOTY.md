---
module: goty
owner_area: product
last_verified_against_commit: 56bdfc6
depends_on: [data-layer, query-optimization]
---

# GOTY — awards section

**Status: not built.** `pages/goty.astro` is a static "coming soon" (intro copy + placeholder for an interactive tier
list). Only `GotyItem` in `types/index.ts` exists. This doc records intended design so future work stays consistent and
extensible.

## Purpose

A separate awards area, distinct from the `/games` library. Games Knekro played are nominated/ranked across **multiple
award tracks per year**:

- Game of the Year
- "Ojeadita of the Year"
- Per-genre awards (e.g. RPG, terror, indie…)

Requirement: adding a new award track or genre must **not** require schema changes — keep categories data-driven.

## Recommended model (extensible — verify/confirm before implementing)

Avoid hardcoding one column per award. Use a category dimension:

| Table              | Purpose                                     | Key columns                                                              |
|--------------------|---------------------------------------------|--------------------------------------------------------------------------|
| `award_categories` | one row per track/genre (data-driven)       | `id, name, slug, kind('overall'                                          |'ojeadita'|'genre'), active` |
| `goty_items`       | a game's placement in a category for a year | `id, year, category_id(FK), game_id(FK→games), rank, votes, tier, notes` |

New award = insert a row in `award_categories`. No migration. Maps cleanly onto existing `GotyItem` (add `category_id`;
`tier` already present for the tier-list UI).

Unique constraint: `(year, category_id, game_id)`. Indexes per `docs/QUERY_OPTIMIZATION.md`:
`(year, category_id, rank)`.

## Typical read

```ts
supabase.from("award_categories")
  .select("name, slug, goty_items(rank, tier, votes, game:games(title, cover_url))")
  .eq("goty_items.year", year)
  .eq("active", true)
  .order("rank", { foreignTable: "goty_items" });
```

## Open questions (unclear — confirm)

- Are votes community-driven (needs auth + a `votes` table with per-user uniqueness) or editorial? Current
  `GotyItem.votes` is a bare count.
- Is the tier list persisted or client-only? UI copy implies drag-to-reorder + community votes.
