# Real-time Vote Updates

> **Superseded** — the realtime approach described here was implemented then rolled back in favor of a simpler flow:
> votes are submitted via `POST /api/games/vote.astro` (HTMX outerHTML swap), which upserts `games_user_votes`,
> re-SELECTs the game with trigger-updated averages, and returns a server-rendered `GameCard`.
> See `ARCHITECTURE.md` for the current design. This file is kept for historical context only.

Plan for adding realtime community-average updates to the `/games` voting UI.

## Goal

When any user votes on a game, all connected clients see the community average update
in real time (~100ms), with no page reload and no UX degradation.

## Approach

Supabase Realtime (Postgres Changes) on the `games_user_votes` table. A browser-side
Supabase client subscribes to INSERT/UPDATE events and updates the affected game card's
community average optimistically.

Writes (votes) also go through the same browser-side Supabase client — the old
`POST /api/games/vote` API endpoint is deprecated.

## Architecture

```
User A votes → browser Supabase client → Supabase DB
                                          ↓
                                   Postgres Change event
                                          ↓
User B's browser ←── WebSocket ←── Realtime server
        ↓
  Update affected game card's average
```

## Files Changed

### New

- `src/lib/client/games-vote-state.ts` — shared DOM update logic (extracted from games-vote.ts)

### Modified

- `src/lib/db-client.ts` — added `supabaseClient` export (browser-side client)
- `src/lib/client/games-vote.ts` — uses Supabase client for writes; tracks "just voted" IDs
- `src/pages/games.astro` — syncs SSR auth session; inits realtime; cleanup on navigation

### Deprecated

- `src/pages/api/games/vote.ts` — no longer needed (writes go direct)

## Prerequisites (DB — must be done in Supabase Dashboard)

1. **Unique constraint** on `games_user_votes(user_id, game_id)` for upsert to work:
   ```sql
   ALTER TABLE games_user_votes ADD CONSTRAINT unique_user_game_vote UNIQUE (user_id, game_id);
   ```
2. **Enable Realtime** on `games_user_votes` (Dashboard → Database → Replication)
3. **RLS policy** allowing `anon` SELECT (so realtime events reach all clients)

## Supabase Free-Tier Limits

- **200 concurrent Realtime connections** (peak simultaneous)
- Exceeding it on free plan → grace period email, no surprise charges
- Monitor in **Project Settings → Product Reports → Realtime**

## Security Trade-off

The JWT moves from `httpOnly` cookies (server-only) to `localStorage` (client-side) when
`setSession()` is called. This is the standard Supabase client-side pattern — the
publishable key is designed for browser exposure, and RLS enforces all data rules.

Both API and client-side approaches are equally secure with proper RLS. Neither hides
network activity (both show in DevTools).

## Edge Cases Handled

| Concern               | Handling                                                                            |
|-----------------------|-------------------------------------------------------------------------------------|
| Own vote double-count | `justVotedGames` Set skips the realtime event for a game the user just voted on     |
| Connection drops      | Realtime auto-reconnects; missed events replay on reconnect                         |
| 200-connection limit  | Graceful degradation — live updates pause until a slot frees up; voting still works |
| Page navigation       | Cleanup on `astro:before-swap` removes channel + listeners                          |
| Rapid events          | Each event processed independently; `data-avg`/`data-avg-count` stay consistent     |

## Verification

1. Open `/games` in two browsers → vote in one, see the other update in ~100ms
2. Check Supabase Dashboard → Realtime reports for connection count
3. `pnpm run build` to confirm no build errors
4. Test clearing a vote, rapid voting, and page navigation
