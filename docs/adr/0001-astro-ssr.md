---
module: adr-0001
owner_area: repo-wide
last_verified_against_commit: 8473325
depends_on: []
---

# 0001 — Astro SSR on Vercel

**Status:** accepted (inferred from `astro.config.mjs`).

**Context:** Content is dynamic (live Twitch state, per-user session, DB-backed games/posts) and the audience hits one deploy target.

**Decision:** `output: "server"` with `@astrojs/vercel`. Data + session resolved per request in `.astro` frontmatter / API routes; no client SPA or data-fetching layer.

**Consequences:** Fresh data + auth on every load; queries must stay cheap and indexed (`docs/QUERY_OPTIMIZATION.md`). No static caching by default — add `Cache-Control`/edge caching deliberately if read volume grows.
