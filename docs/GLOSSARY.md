---
module: glossary
owner_area: repo-wide
last_verified_against_commit: 56bdfc6
depends_on: []
---

# Glossary

| Term          | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| Knekro        | Twitch streamer; the site's subject and brand                            |
| Hub           | This site — aggregates stream, games library, awards                     |
| GOTY          | Awards section: Game of the Year + other yearly tracks                   |
| Ojeadita      | A Knekro-community award track ("a little look/peek"); one GOTY category |
| Games library | `/games` — catalog of games played on stream, filtered by status         |
| `game_status` | Lookup table of library states (e.g. "En progreso"), drives filter tabs  |
| Post          | Community/news entry shown in the home feed (`posts` table)              |
| Stream log    | A single stream session record (`StreamLog` type; table not yet built)   |
| Category      | Twitch/provider category attached to a stream (`Category` type)          |
| Notch         | `.knk-notch` clipped-corner shape — the site's signature UI motif        |
| SSR client    | Per-request `@supabase/ssr` `createServerClient` for cookie sessions     |
| Embedding     | PostgREST FK-based join done inside one `.select()`                      |
| PUBLIC_*      | Client-safe env vars; anything without the prefix is server-only         |
