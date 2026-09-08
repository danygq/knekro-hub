---
module: routing-ui
owner_area: frontend
last_verified_against_commit: e12fc05
depends_on: [data-layer, auth]
---

# Routing & UI

File-based routing (Astro). All pages wrap `layouts/Layout.astro`.

## Routes

| Path                    | File                               | Renders                                               | Data                                                      |
|-------------------------|------------------------------------|-------------------------------------------------------|-----------------------------------------------------------|
| `/`                     | `pages/index.astro`                | Twitch player + chat embeds, YouTube slot, posts feed | `posts` (server)                                          |
| `/games`                | `pages/games/index.astro`          | Status filter panel + DB-backed games grid             | `game_status` + `games` via `lib/games.ts` (server)     |
| `/goty`                 | `pages/goty.astro`                 | Awards intro + "coming soon" tier list                | none (static)                                             |
| `/auth/callback`        | `pages/auth/callback.ts`           | OAuth code exchange, redirect                         | —                                                         |
| `/auth/auth-code-error` | `pages/auth/auth-code-error.astro` | Auth failure page                                     | —                                                         |
| `/api/auth/signin`      | `pages/api/auth/signin.ts`         | `POST` → Twitch OAuth redirect                        | —                                                         |
| `/api/auth/signout`     | `pages/api/auth/signout.ts`        | `POST` → sign out, redirect `/`                       | —                                                         |

Referenced but **not present**: `/posts/[id]` (linked from home feed). Add when posts detail is built.

## Layout

`Layout.astro`: sticky header (logo, nav `Juegos`/`GOTY`, Twitch/Discord CTAs), active-nav via `Astro.url.pathname`,
session via SSR client `getUser()`, renders `UserMenu` or `LoginButton`. Fonts: Space Grotesk (display) + Inter (body)
from Google Fonts.

> Bug: `<main>` and `<footer>` are emitted **after** `</body></html>`. Fix markup so they sit inside `<body>`.

## Components

| Component           | Role                                                               |
|---------------------|--------------------------------------------------------------------|
| `LoginButton.astro` | Form `POST /api/auth/signin`, Twitch-branded                       |
| `UserMenu.astro`    | Avatar + display name (`user_metadata`) + `POST /api/auth/signout` |
| `TwitchLogo.astro`  | Inline SVG mark                                                    |
| `GameCard.astro`    | 2:3 cover card for the grid (`data-status-ids`, status badge)     |

## Theming (`src/styles/`)

All CSS lives in one folder, split by responsibility. Tailwind v4 via `@tailwindcss/vite`; **no config file**.

| File | Contents | Loaded by |
|---|---|---|
| `global.css` | entry: `@import "tailwindcss"` + tokens/base/utilities | Layout (all pages) |
| `tokens.css` | `--knk-*` CSS vars on `:root` | via `global.css` |
| `base.css` | `body`, `::selection`, focus ring, reduced-motion | via `global.css` |
| `utilities.css` | `.knk-notch` / `.knk-notch-sm`, `.knk-eyebrow`, `.knk-grid-bg` | via `global.css` |
| `pages/games.css` | `/games` filter panel + off-canvas drawer (moved out of the old `<style is:global>` block) | `pages/games/index.astro` frontmatter |

Use `bg-(--knk-surface)`, `text-(--knk-text-muted)`, etc.

Palette: `--knk-bg #0a0d12`, `--knk-surface` / `--knk-surface-2`, `--knk-line` / `--knk-line-strong`,
`--knk-text` / `-muted` / `-faint`, primary `--knk-primary` (blue), secondary `--knk-secondary` (amber),
third-party brand `--knk-twitch` / `--knk-discord` (each with `-hover`), danger `--knk-danger`
(+ `--knk-danger-hover`). Fonts: `--font-display`
(Space Grotesk), `--font-body` (Inter). Signature shapes: `.knk-notch` / `.knk-notch-sm` (clipped corners),
`.knk-grid-bg`, `.knk-eyebrow`.
