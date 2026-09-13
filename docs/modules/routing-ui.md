---
module: routing-ui
owner_area: frontend
last_verified_against_commit: fc4b86e
depends_on: [data-layer, auth]
---

# Routing & UI

File-based routing (Astro). All pages wrap `layouts/Layout.astro`.

## Routes

| Path                    | File                               | Renders                                                                                  | Data                                                                                                   |
|-------------------------|------------------------------------|------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `/`                     | `pages/index.astro`                | Twitch player + chat embeds, YouTube slot, posts feed                                    | `posts` (server)                                                                                       |
| `/games`                | `pages/games.astro`                | Status filter drawer (`GamesFilterMenu`) + name search (`GameSearch`) + games grid       | `game_status` + `games` via `lib/games.ts` (server); search & status filtering via `/api/games/search` |
| `/goty`                 | `pages/goty.astro`                 | Awards intro + "coming soon" tier list                                                   | none (static)                                                                                          |
| `/auth/callback`        | `pages/auth/callback.ts`           | OAuth code exchange, redirect                                                            | —                                                                                                      |
| `/auth/auth-code-error` | `pages/auth/auth-code-error.astro` | Auth failure page                                                                        | —                                                                                                      |
| `/api/auth/signin`      | `pages/api/auth/signin.ts`         | `POST` → Twitch OAuth redirect                                                           | —                                                                                                      |
| `/api/auth/signout`     | `pages/api/auth/signout.ts`        | `POST` → sign out, redirect `/`                                                          | —                                                                                                      |
| `/api/games/search`     | `pages/api/games/search.astro`     | `GET` → name search + status filtering + pagination (HTML fragments + OOB counter swaps) | `q`, `inc`, `exc`, `offset`, `limit` query params                                                      |
| `/api/games/vote`       | `pages/api/games/vote.astro`       | `POST` → submit/clear game vote, return server-rendered `GameCard` (HTMX outerHTML swap) | `game_id`, `vote` form data                                                                            |

Referenced but **not present**: `/posts/[id]` (linked from home feed). Add when posts detail is built.

## Layout & Page Composition

### `Layout.astro`

Sticky header (logo, nav `Juegos`/`GOTY`, mobile dropdown menu with hamburger toggle, Twitch/Discord CTAs), active-nav via `Astro.url.pathname`,
session via SSR client `getUser()`, renders `UserMenu` or `LoginButton`. Fonts: Space Grotesk (display) + Inter (body),
self-hosted from `public/fonts/` (see `src/styles/fonts.css`).
Responsive mobile menu is powered by Alpine.js (`x-data="{ mobileMenuOpen: false }"`). `<main>` and `<footer>` reside within `<body>`.

### `pages/games.astro`

Main games library route. Performs initial SSR fetches:

- `loadGameStatuses(dbClient)`: list of statuses with game counts.
- `loadGames(dbClient, user?.id)`: initial set of games with community stats and user vote.
- `loadTotalGamesCount(dbClient)`: total game count for counter headers.

Initializes Alpine stores on `alpine:init`:

- `games.layout`: `{ isDesktop, gamesFilterMenuOpen }`.
- `search`: `{ query, filters: { status: statusFilterStore } }`.

Renders `GamesLayout.astro` with fetched data.

## Components

### Shell (`src/components/`)

| Component           | Role                                                               |
|---------------------|--------------------------------------------------------------------|
| `LoginButton.astro` | Form `POST /api/auth/signin`, Twitch-branded                       |
| `UserMenu.astro`    | Avatar + display name (`user_metadata`) + `POST /api/auth/signout` |
| `TwitchLogo.astro`  | Inline SVG mark                                                    |

### Games Library (`src/components/games/`)

| Component                       | Role                                                                                                                                                                                             |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `GamesLayout.astro`             | Main layout container. Manages drawer toggle button (with active filter count badge) and responsive classes (`filters-off`). Contains filter menu, search, and grid.                                                             |
| `GamesFilterMenu.astro`         | Off-canvas/sidebar filter panel. Provides 3-state status filtering (include `+`, exclude `-`, neutral) per status plus "Todas" reset. Binds to `$store.search.filters.status` and dispatches `filter-changed` event.             |
| `GameSearch.astro`              | Search input field with 300ms debounce, loading spinner (`.htmx-request`), and clear button. Triggers HTMX `GET /api/games/search` on input and `filter-changed` from body, serializing Alpine store values (`q`, `inc`, `exc`). |
| `GameCard.astro`                | 2:3 card displaying cover, status, community votes, and personal vote. Owns Alpine local state (`x-data="{ open: false }"`) for toggling `VoteOverlay`.                                                                          |
| `GameCover.astro`               | Cover image handler with fallback placeholder SVG when `cover_url` is missing.                                                                                                                                                   |
| `GameStatusBadge.astro`         | Status badge pinned to top-left of the card cover.                                                                                                                                                                               |
| `GameCommunityVotesBadge.astro` | Displays community vote average (formatted via `formatAvg`) and total vote count on the card.                                                                                                                                    |
| `GameUserVoteBadge.astro`       | Highlights the current logged-in user's vote on the card.                                                                                                                                                                        |
| `VoteOverlay.astro`             | Interactive popover overlay with 1–10 rating buttons for authenticated users.                                                                                                                                                    |
| `VoteButton.astro`              | HTMX vote button posting to `/api/games/vote`. Replaces card with updated server response via `outerHTML`.                                                                                                                       |

## Progressive Interactivity & State Architecture

Interactivity on `/games` follows a unified Alpine + HTMX pattern:

```
[GamesFilterMenu]                  [GameSearch]
       │                                │
  toggle status                    type query
       │                                │
updates $store.search            updates $store.search.query
       │                                │
dispatches 'filter-changed' ───────────►│
                                   HTMX triggers hx-get="/api/games/search"
                                   hx-vals bundles { q, inc, exc }
                                        │
                                        ▼
                           GET /api/games/search.astro
                                        │
                         Server filters via Supabase
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        HTML cards swapped into #games-grid     OOB swaps for counts & empty state
```

- **Alpine.js**: Manages purely client-side UI states (`$store.games.layout`, `$store.search`, and card overlay `open`).
- **HTMX**: Handles all server interactions (`/api/games/search` and `/api/games/vote`), rendering and swapping server
  components directly into the DOM without client-side JSON reconstruction.

## Theming (`src/styles/`)

All CSS lives in one folder, split by responsibility. Tailwind v4 via `@tailwindcss/vite`; **no config file**.

| File              | Contents                                                                                                     | Loaded by                       |
|-------------------|--------------------------------------------------------------------------------------------------------------|---------------------------------|
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
