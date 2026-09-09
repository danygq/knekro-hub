// Game-library domain types.
// `GameListRow` is the slim projection actually loaded by `loadGamesLibrary()`
// in `lib/games.ts`; `Game` is the full entity, aspirational until the `games`
// table is confirmed against Supabase.

/** Lookup row of game states (e.g. "En progreso"); drives the filter panel. */
export interface GameStatus {
  id: number;
  name: string;
}

// The `status` column arrives as either a single embedded row, an array of
// embedded rows (a one-to-many join on game_status), or null.
export type GameStatusRefOrList = GameStatus | GameStatus[] | null;

/**
 * One row of the games grid: exactly the columns `/games` selects from
 * `games` (id, name, cover_url) plus the embedded `status` join.
 */
export interface GameListRow {
  id: number;
  name: string;
  cover_url: string | null;
  status: GameStatusRefOrList;
}

/** A `GameStatus` augmented with how many games carry it (filter badge). */
export interface GameStatusWithCount extends GameStatus {
  count: number;
}

/**
 * One row of the games_user_votes table as the /games page reads it.
 * `vote` is null when the user cleared their vote (a row may still exist).
 */
export interface UserVote {
  id: number;
  game_id: number;
  vote: number | null;
}

/** Community average for a game, derived from all non-null votes. */
export interface CommunityAverage {
  avg: number;
  count: number;
}

/**
 * Full game entity (aspirational: not yet confirmed against the schema).
 * NOTE: `status` is typed as a single `GameStatus`, but the DB embed can also
 * return an array/null — for raw rows use `GameStatusRefOrList`.
 */
export interface Game {
  id: number; // UUID or slug
  title: string;
  slug?: string; // friendly URL segment
  description?: string;
  cover_url?: string;
  platforms?: string[];
  status: GameStatus;
  play_count?: number; // times played on stream
  added_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  tags?: string[];
}
