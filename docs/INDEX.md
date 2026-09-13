---
module: index
owner_area: repo-wide
last_verified_against_commit: 0d27f3f
depends_on: []
---

# Docs index

Token-optimized docs for `knekro-hub`. Load only what you need — each file is self-contained and front-matter tagged
(`module`, `depends_on`) so you can grep before reading.

## Start here

- [`/AGENTS.md`](../AGENTS.md) — agent rules, conventions, where NOT to edit.
- [`/ARCHITECTURE.md`](../ARCHITECTURE.md) — system map, module table, risks.

## Modules

- [`modules/routing-ui.md`](modules/routing-ui.md) — pages, Layout, components, theming.
- [`modules/auth.md`](modules/auth.md) — Twitch OAuth + SSR session flow.
- [`modules/data-layer.md`](modules/data-layer.md) — Supabase clients, known tables, types.

## Guides

- [`QUERY_OPTIMIZATION.md`](QUERY_OPTIMIZATION.md) — Postgres/PostgREST select + join + index rules.
- [`GOTY.md`](GOTY.md) — awards section design (extensible, not yet built).
- [`GLOSSARY.md`](GLOSSARY.md) — domain terms.
- [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md) — issue creation, branching, commits, PRs & execution protocol.

## Decisions & meta

- [`adr/`](adr/) — architecture decision records.
- [`DOC_COVERAGE.md`](DOC_COVERAGE.md) — what's documented + confidence.
