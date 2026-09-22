---
module: routing-ui
owner_area: frontend
last_verified_against_commit: 5cdf394
depends_on: [data-layer, auth]
---

# Routing & UI

File-based routing (Astro). All pages wrap `layouts/Layout.astro`.

## Routes

| Path                    | File                               | Renders                                                                                                                          | Data                                                                                                   |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                     | `pages/index.astro`                | Twitch player + chat embeds, live broadcast status & timer, YouTube slot, posts feed                                             | `posts`, `streams` (server)                                                                            |
| `/games`                | `pages/games.astro`                | Status filter drawer (`GamesFilterMenu`) + name search (`GameSearch`) + games grid                                               | `game_status` + `games` via `lib/games.ts` (server); search & status filtering via `/api/games/search` |
| `/games/[id]`           | `pages/games/[id].astro`           | Game detail page (cover, tags with expander, editable status for owners/managers via `GameStatusEditor`, voting, stream history) | `loadGameById` via `get_game_by_id` RPC (server)                                                       |
| `/streams`              | `pages/streams/index.astro`        | Monthly streams calendar (LUN-DOM grid, day boxes, stream indicators) + responsive aside detail drawer (`StreamDetailDrawer`)    | `loadStreamsForCalendar` via `get_streams_by_date_range` RPC (server)                                  |
| `/streams/[id]`         | `pages/streams/[id].astro`         | Standalone stream detail page (hero metadata, broadcast timing, chronological category & game timeline with segment durations)   | `loadStreamById` via `get_stream_by_id` RPC (server)                                                   |
| `/ranking`              | `pages/ranking/index.astro`        | Rankings hub — category track panels (`ranking_categories`)                                                                      | `ranking_categories` via `lib/ranking.ts` (server)                                                     |
| `/ranking/goty`         | `pages/ranking/goty.astro`         | Dedicated GOTY category ranking & podium                                                                                         | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/ranking/vuela-alto`   | `pages/ranking/vuela-alto.astro`   | Dedicated Vuela Alto category ranking & podium                                                                                   | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/ranking/[slug]`       | `pages/ranking/[slug].astro`       | Dynamic category ranking fallback route                                                                                          | `ranking_categories`, `ranking_items`, `games` via `lib/ranking.ts`                                    |
| `/404`                  | `pages/404.astro`                  | 404 error page ("¿Cómo salgo de la tetera?") with emote image and return home CTA                                                | —                                                                                                      |
| `/auth/callback`        | `pages/auth/callback.ts`           | OAuth code exchange, redirect                                                                                                    | —                                                                                                      |
| `/auth/auth-code-error` | `pages/auth/auth-code-error.astro` | Auth failure page                                                                                                                | —                                                                                                      |
| `/api/auth/signin`      | `pages/api/auth/signin.ts`         | `POST` → Twitch OAuth redirect                                                                                                   | —                                                                                                      |
| `/api/auth/signout`     | `pages/api/auth/signout.ts`        | `POST` → sign out, redirect `/`                                                                                                  | —                                                                                                      |
| `/api/games/search`     | `pages/api/games/search.astro`     | `GET` → name search + status filtering + pagination (HTML fragments + OOB counter swaps)                                         | `q`, `inc`, `exc`, `offset`, `limit` query params                                                      |
| `/api/games/vote`       | `pages/api/games/vote.astro`       | `POST` → submit/clear game vote, return server-rendered `GameCard` or `GameDetailVoting` (`view=detail`) (HTMX outerHTML swap)   | `game_id`, `vote`, `view` form data                                                                    |
| `/api/games/status`     | `pages/api/games/status.astro`     | `POST` → updates game status with audit log entry for owner/manager roles (HTMX outerHTML swap of `GameStatusEditor`)            | `game_id`, `status_id` form data                                                                       |
| `/api/ranking/search`   | `pages/api/ranking/search.astro`   | `GET` → paginated game search for ranking assignments                                                                            | `q`, `category_id`, `year`, `offset`, `limit`                                                          |
| `/api/ranking/podium`   | `pages/api/ranking/podium.ts`      | `POST` → assign/swap/remove podium ranks (renders `RankingPodium.astro` via container for seamless swap)                         | `action`, `categoryId`, `gameId`, `rank`, `year`                                                       |

Referenced but **not present**: `/posts/[id]` (linked from home feed). Add when posts detail is built. Unmatched routes and non-existent resource IDs (`/games/[id]`, `/streams/[id]`) rewrite or route to `pages/404.astro`.

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
- `loadTags(dbClient)`: list of tags/genres with game counts (`games_with_this_tag > 0`).
- `fetchGames(dbClient, { userId, limit: 24, sort: initialSort })`: initial set of 24 games loaded directly with the user's preferred sort, read from `knk_games_preferences` cookie during SSR.

Initializes Alpine stores on `alpine:init`:

- `games.layout`: `{ isDesktop, gamesFilterMenuOpen }`.
- `search`: `{ query, offset: 0, limit: 24, sort: effectiveSort, filters: { status, tag, resetAll(), totalCount }, setSort(), resetOffset() }`.
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

| Component                       | Role                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GamesLayout.astro`             | Main layout container. Manages drawer toggle button (with active filter count badge summing status and genre filters) and responsive classes (`filters-off`). Contains filter menu, search, and grid.                                                                                                                                                        |
| `GamesFilterMenu.astro`         | Off-canvas/sidebar filter panel with collapsible Estado and Géneros sections (expanded by default). Provides 3-state filtering (include `+`, exclude `-`, neutral) for statuses and genres, inline genre search, bounded scrollable container (max 10 items), and "Todas" reset all. Binds to `$store.search.filters` and dispatches `filter-changed` event. |
| `GameSearch.astro`              | Search input field with 300ms debounce, loading spinner (`.htmx-request`), and clear button. Triggers HTMX `GET /api/games/search` on input and `filter-changed` from body, serializing Alpine store values (`q`, `inc`, `exc`, `inc_tags`, `exc_tags`, `sort`, `offset: 0`, `limit: 24`).                                                                   |
| `GameSortDropdown.astro`        | Sort dropdown popover for ordering games (alphabetical, community vote avg, and personal user votes). Updates `$store.search.sort` and dispatches `filter-changed`.                                                                                                                                                                                          |
| `GameCard.astro`                | 2:3 card displaying cover, status, community votes, and personal vote. Owns Alpine local state (`x-data="{ open: false }"`) for toggling `VoteOverlay`.                                                                                                                                                                                                      |
| `GameCover.astro`               | Cover image handler with dynamic lazy/eager loading support and fallback placeholder SVG when `cover_url` is missing.                                                                                                                                                                                                                                        |
| `GameStatusBadge.astro`         | Status badge pinned to top-left of the card cover. Reused across `GameCard`, `RankingGameCard`, and `RankingPodiumSlot`.                                                                                                                                                                                                                                     |
| `GameCommunityVotesBadge.astro` | Displays community vote average (formatted via `formatAvg`) and total vote count on the card.                                                                                                                                                                                                                                                                |
| `GameUserVoteBadge.astro`       | Highlights the current logged-in user's vote on the card.                                                                                                                                                                                                                                                                                                    |
| `VoteOverlay.astro`             | Interactive popover overlay with 1–10 rating buttons for authenticated users. Displays celebratory dynamic Knekro catchphrases with tier-matching colors upon voting/changing vote.                                                                                                                                                                          |
| `VoteButton.astro`              | HTMX vote button posting to `/api/games/vote`. Triggers radial ray burst animation (colored or neutral on retraction) and delays swap for feedback legibility.                                                                                                                                                                                               |
| `VoteBurst.astro`               | Reusable radial ray burst particle component with 8 rays animating outward via `@keyframes knk-burst-ray`. Supports active tier colors and neutral colorless mode.                                                                                                                                                                                           |
| `GameDetailTags.astro`          | Renders game tags in a dedicated flex container below the cover art on `/games/[id]`. Displays up to 5 tags with inline `...` button expanding remaining tags in place.                                                                                                                                                                                      |
| `GameDetailVoting.astro`        | Rating and voting section on `/games/[id]`. Renders community vote average/count, 1–10 rating buttons (`view=detail`) with burst animation and inline animated catchphrase callout (3s auto-dismiss), or Twitch login prompt.                                                                                                                                |
| `GameStatusEditor.astro`        | Game status badge and inline editor on `/games/[id]`. Renders read-only badge for regular visitors, and interactive pencil button with Alpine popover status picker for `owner` and `manager` roles, updating via HTMX `POST /api/games/status`.                                                                                                             |
| `InfiniteScrollSentinel.astro`  | Infinite scroll sentinel trigger rendered at grid bottom when more games exist. Triggers HTMX `GET /api/games/search` on `revealed` and swaps `outerHTML` with next batch of cards + next sentinel (passing `inc_tags` and `exc_tags`).                                                                                                                      |

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

### Streams & Calendar (`src/components/streams/`)

| Component                      | Role                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StreamCalendar.astro`         | Month calendar wrapper: navigation header (`←`, month name, `→`, `Hoy`), Monday..Sunday weekday headers (`LUN` to `DOM`), and 7-column day grid.                               |
| `StreamDayBox.astro`           | Individual calendar cell: day number, "Hoy" highlight, stream status badge (duration or live badge), category/game covers glimpse, and click handler opening the aside drawer. |
| `StreamDetailDrawer.astro`     | Responsive aside detail drawer: mobile off-canvas drawer with backdrop, desktop slide-over panel, broadcast timings, segment intervals, and link to `/streams/[id]`.           |
| `StreamActivityTimeline.astro` | Chronological vertical timeline displaying each category transition with start time, end time, segment duration badge, category title, and linked game card.                   |

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
 toggle status/genre               type query                           scroll near bottom
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

| File                | Contents                                                                                                        | Loaded by                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `global.css`        | entry: `@import "tailwindcss"` + tokens/base/utilities                                                          | Layout (all pages)                                    |
| `tokens.css`        | `--knk-*` CSS vars on `:root`                                                                                   | via `global.css`                                      |
| `base.css`          | `body`, `::selection`, focus ring, reduced-motion, and `[x-cloak]` (`display: none !important`)                 | via `global.css`                                      |
| `utilities.css`     | `.knk-notch` / `.knk-notch-sm`, `.knk-eyebrow`, `.knk-grid-bg`                                                  | via `global.css`                                      |
| `pages/games.css`   | `/games` filter panel (`.knk-filter-panel`, `.knk-filter-backdrop`, `.knk-filter-plus`, `.knk-filter-minus`)    | `pages/games.astro` frontmatter                       |
| `pages/streams.css` | `/streams` calendar & detail drawer (`.knk-stream-aside-panel`, `.knk-stream-backdrop`, `.knk-stream-timeline`) | `pages/streams/index.astro`, `[id].astro` frontmatter |

Use `bg-(--knk-surface)`, `text-(--knk-text-muted)`, etc.

Palette: `--knk-bg #0a0d12`, `--knk-surface` / `--knk-surface-2`, `--knk-line` / `--knk-line-strong`,
`--knk-text` / `-muted` / `-faint`, primary `--knk-primary` (blue), secondary `--knk-secondary` (amber),
third-party brand `--knk-twitch` / `--knk-discord` (each with `-hover`), danger `--knk-danger`
(+ `--knk-danger-hover`). Fonts: `--font-display`
(Space Grotesk), `--font-body` (Inter). Signature shapes: `.knk-notch` / `.knk-notch-sm` (clipped corners),
`.knk-grid-bg`, `.knk-eyebrow`.
