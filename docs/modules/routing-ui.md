---
module: routing-ui
owner_area: frontend
last_verified_against_commit: fee8c71
depends_on: [data-layer, auth]
---

# Routing & UI

File-based routing (Astro). All pages wrap `layouts/Layout.astro`.

## Routes

| Path                    | File                               | Renders                                                                                                  | Data                                                                                                   |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                     | `pages/index.astro`                | Twitch player + chat embeds, live broadcast status & timer, YouTube slot, posts feed                     | `posts`, `streams` (server)                                                                            |
| `/games`                | `pages/games.astro`                | Status filter drawer (`GamesFilterMenu`) + name search (`GameSearch`) + games grid                       | `game_status` + `games` via `lib/games.ts` (server); search & status filtering via `/api/games/search` |
| `/ranking`              | `pages/ranking/index.astro`        | Rankings hub — category track panels (`ranking_categories`)                                              | `ranking_categories` via `lib/ranking.ts` (server)                                                     |
| `/ranking/goty`         | `pages/ranking/goty.astro`         | Dedicated GOTY category ranking & podium                                                                 | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/ranking/vuela-alto`   | `pages/ranking/vuela-alto.astro`   | Dedicated Vuela Alto category ranking & podium                                                           | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/ranking/[slug]`       | `pages/ranking/[slug].astro`       | Dynamic category ranking fallback route                                                                  | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/auth/callback`        | `pages/auth/callback.ts`           | OAuth code exchange, redirect                                                                            | —                                                                                                      |
| `/auth/auth-code-error` | `pages/auth/auth-code-error.astro` | Auth failure page                                                                                        | —                                                                                                      |
| `/api/auth/signin`      | `pages/api/auth/signin.ts`         | `POST` → Twitch OAuth redirect                                                                           | —                                                                                                      |
| `/api/auth/signout`     | `pages/api/auth/signout.ts`        | `POST` → sign out, redirect `/`                                                                          | —                                                                                                      |
| `/api/games/search`     | `pages/api/games/search.astro`     | `GET` → name search + status filtering + pagination (HTML fragments + OOB counter swaps)                 | `q`, `inc`, `exc`, `offset`, `limit` query params                                                      |
| `/api/games/vote`       | `pages/api/games/vote.astro`       | `POST` → submit/clear game vote, return server-rendered `GameCard` (HTMX outerHTML swap)                 | `game_id`, `vote` form data                                                                            |
| `/api/ranking/search`   | `pages/api/ranking/search.astro`   | `GET` → paginated game search for ranking assignments                                                    | `q`, `category_id`, `year`, `offset`, `limit`                                                          |
| `/api/ranking/podium`   | `pages/api/ranking/podium.ts`      | `POST` → assign/swap/remove podium ranks (renders `RankingPodium.astro` via container for seamless swap) | `action`, `categoryId`, `gameId`, `rank`, `year`                                                       |

Referenced but **not present**: `/posts/[id]` (linked from home feed). Add when posts detail is built.

## Layout & Page Composition

### `Layout.astro`

Sticky header (logo, nav `Juegos`/`Rankings`, mobile dropdown menu with hamburger toggle, Twitch/Discord CTAs), active-nav
via `Astro.url.pathname.startsWith(...)`,
session via SSR client `getUser()`, renders `UserMenu` or `LoginButton`. Fonts: Space Grotesk (display) + Inter (body),
self-hosted from `public/fonts/` (see `src/styles/fonts.css`).
Responsive mobile menu is powered by Alpine.js (`x-data="{ mobileMenuOpen: false }"`). `<main>` and `<footer>` reside
within `<body>`.

### `pages/games.astro`

Main games library route. Performs initial SSR fetches:

- `loadGameStatuses(dbClient)`: list of statuses with game counts.
- `fetchGames(dbClient, { userId, limit: 24, sort: initialSort })`: initial set of 24 games loaded directly with the user's preferred sort, read from `knk_games_preferences` cookie during SSR.

Initializes Alpine stores on `alpine:init`:

- `games.layout`: `{ isDesktop, gamesFilterMenuOpen }`.
- `search`: `{ query, offset: 0, limit: 24, sort: effectiveSort, filters: { status: statusFilterStore }, setSort(), resetOffset() }`.
- Reads stored sorting preference from cookie/localStorage (`knk_games_preferences` via `src/lib/preferences.ts`); falls back to `name_asc` if unauthenticated and personal vote sort was saved. Because SSR renders with the preferred sort on initial load, no secondary client search request is needed on page refresh.

Renders `GamesLayout.astro` with fetched data and matching initial dropdown label.

## Components

### Shell (`src/components/`)

| Component           | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `LoginButton.astro` | Form `POST /api/auth/signin`, Twitch-branded                                           |
| `UserMenu.astro`    | Avatar + display name (`user_metadata`) + `POST /api/auth/signout`                     |
| `TwitchLogo.astro`  | Inline SVG mark                                                                        |
| `Spinner.astro`     | Reusable loading spinner wrapping `@lucide/astro`'s `LoaderCircle` with `animate-spin` |

### Games Library (`src/components/games/`)

| Component                       | Role                                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GamesLayout.astro`             | Main layout container. Manages drawer toggle button (with active filter count badge) and responsive classes (`filters-off`). Contains filter menu, search, and grid.                                                                                               |
| `GamesFilterMenu.astro`         | Off-canvas/sidebar filter panel. Provides 3-state status filtering (include `+`, exclude `-`, neutral) per status plus "Todas" reset. Binds to `$store.search.filters.status` and dispatches `filter-changed` event.                                               |
| `GameSearch.astro`              | Search input field with 300ms debounce, loading spinner (`.htmx-request`), and clear button. Triggers HTMX `GET /api/games/search` on input and `filter-changed` from body, serializing Alpine store values (`q`, `inc`, `exc`, `sort`, `offset: 0`, `limit: 24`). |
| `GameSortDropdown.astro`        | Sort dropdown popover for ordering games (alphabetical, community vote avg, and personal user votes). Updates `$store.search.sort` and dispatches `filter-changed`.                                                                                                |
| `GameCard.astro`                | 2:3 card displaying cover, status, community votes, and personal vote. Owns Alpine local state (`x-data="{ open: false }"`) for toggling `VoteOverlay`.                                                                                                            |
| `GameCover.astro`               | Cover image handler with dynamic lazy/eager loading support and fallback placeholder SVG when `cover_url` is missing.                                                                                                                                              |
| `GameStatusBadge.astro`         | Status badge pinned to top-left of the card cover. Reused across `GameCard`, `RankingGameCard`, and `RankingPodiumSlot`.                                                                                                                                           |
| `GameCommunityVotesBadge.astro` | Displays community vote average (formatted via `formatAvg`) and total vote count on the card.                                                                                                                                                                      |
| `GameUserVoteBadge.astro`       | Highlights the current logged-in user's vote on the card.                                                                                                                                                                                                          |
| `VoteOverlay.astro`             | Interactive popover overlay with 1–10 rating buttons for authenticated users.                                                                                                                                                                                      |
| `VoteButton.astro`              | HTMX vote button posting to `/api/games/vote`. Replaces card with updated server response via `outerHTML`.                                                                                                                                                         |
| `InfiniteScrollSentinel.astro`  | Infinite scroll sentinel trigger rendered at grid bottom when more games exist. Triggers HTMX `GET /api/games/search` on `revealed` and swaps `outerHTML` with next batch of cards + next sentinel.                                                                |

### Rankings (`src/components/ranking/`)

| Component                    | Role                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RankingGameCard.astro`      | 2:3 card in the selection pool with `GameCover`, `GameStatusBadge`, and `RankingMedalOverlay`.         |
| `RankingPodium.astro`        | Podium container wrapping 3 `RankingPodiumSlot` slots (Gold, Silver, Bronze).                          |
| `RankingPodiumSlot.astro`    | Podium slot dropzone and ranked card display with `RankingMedalOverlay` (mover/quitar actions).        |
| `RankingMedalOverlay.astro`  | Hover overlay for ranking cards with Oro/Plata/Bronce quick assignment/move buttons and Quitar action. |
| `RankingSearch.astro`        | Search input field for ranking game pool with HTMX search and `Spinner`.                               |
| `RankingSentinel.astro`      | Infinite scroll sentinel trigger for ranking search games with `Spinner`.                              |
| `RankingSectionLayout.astro` | Section wrapper for dedicated ranking category views (header, podium wrapper, and selection pool).     |
| `RankingPodiumScript.astro`  | Client-side SortableJS drag & drop logic and handlers for podium assignment/swaps.                     |

### Icons & SVGs

Icons across the project are standardized using [`@lucide/astro`](https://lucide.dev/guide/packages/lucide-astro):

- **Zero Client Overhead**: In `.astro` templates, `@lucide/astro` components are server-rendered at build time directly into optimized SVG HTML markup with zero client-side JavaScript bundle cost.
- **Component Usage**: Import individual icon components directly from `@lucide/astro` (e.g. `import { Search, X, ChevronLeft, ChevronDown, Check, SlidersHorizontal, RefreshCw, Gamepad, Menu, CircleAlert } from "@lucide/astro";`).
- **Styling**: Pass sizing and stroke classes directly via Tailwind utilities, e.g. `<Search class="size-4 text-(--knk-text-muted)" />`.
- **Inline SVGs Exception**: Use bespoke inline SVGs only for third-party brand logos (such as `TwitchLogo.astro`). Standard UI glyphs, controls, and loaders (`Spinner.astro` wrapping `LoaderCircle`) use `@lucide/astro` rather than hand-inlined SVG paths.

## Progressive Interactivity & State Architecture

Interactivity on `/games` follows a unified Alpine + HTMX pattern:

```
[GamesFilterMenu]                  [GameSearch]                    [InfiniteScrollSentinel]
       │                                │                                    │
  toggle status                    type query                           scroll near bottom
       │                                │                                    │
resets $store.search.offset = 0    resets $store.search.offset = 0           fires revealed event
       │                                │                                    │
dispatches 'filter-changed' ───────────►│                                    │
                                   HTMX hx-get="/api/games/search"           HTMX hx-get="/api/games/search"
                                   offset=0, limit=24                        offset=24, 48..., limit=24
                                   hx-swap="innerHTML" on #games-grid        hx-swap="outerHTML" on sentinel
                                        │                                    │
                                        └─────────────────┬──────────────────┘
                                                          ▼
                                             GET /api/games/search.astro
                                                          │
                                            Server filters & pages via Supabase
                                                          │
                    ┌─────────────────────────────────────┴─────────────────────────────────────┐
                    ▼                                                                           ▼
        HTML cards + next sentinel swapped into grid                                OOB swaps for counts & empty state
```

- **Alpine.js**: Manages purely client-side UI states (`$store.games.layout`, `$store.search` with pagination offset
  tracking & reset, and card overlay `open`).
- **HTMX**: Handles all server interactions (`/api/games/search` and `/api/games/vote`), rendering and swapping server
  components directly into the DOM without client-side JSON reconstruction.
- **Infinite Scrolling**: Batches games in chunks of 24. Subsequent batches advance the offset by 24 (`24`, `48`,
  `72`...). Searching or filtering immediately invokes `resetOffset()` to reset the offset to 0 and replace the grid
  from the beginning.

## Theming (`src/styles/`)

All CSS lives in one folder, split by responsibility. Tailwind v4 via `@tailwindcss/vite`; **no config file**.

| File              | Contents                                                                                                     | Loaded by                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `global.css`      | entry: `@import "tailwindcss"` + tokens/base/utilities                                                       | Layout (all pages)              |
| `tokens.css`      | `--knk-*` CSS vars on `:root`                                                                                | via `global.css`                |
| `base.css`        | `body`, `::selection`, focus ring, reduced-motion, and `[x-cloak]` (`display: none !important`)              | via `global.css`                |
| `utilities.css`   | `.knk-notch` / `.knk-notch-sm`, `.knk-eyebrow`, `.knk-grid-bg`                                               | via `global.css`                |
| `pages/games.css` | `/games` filter panel (`.knk-filter-panel`, `.knk-filter-backdrop`, `.knk-filter-plus`, `.knk-filter-minus`) | `pages/games.astro` frontmatter |

Use `bg-(--knk-surface)`, `text-(--knk-text-muted)`, etc.

Palette: `--knk-bg #0a0d12`, `--knk-surface` / `--knk-surface-2`, `--knk-line` / `--knk-line-strong`,
`--knk-text` / `-muted` / `-faint`, primary `--knk-primary` (blue), secondary `--knk-secondary` (amber),
third-party brand `--knk-twitch` / `--knk-discord` (each with `-hover`), danger `--knk-danger`
(+ `--knk-danger-hover`). Fonts: `--font-display`
(Space Grotesk), `--font-body` (Inter). Signature shapes: `.knk-notch` / `.knk-notch-sm` (clipped corners),
`.knk-grid-bg`, `.knk-eyebrow`.
