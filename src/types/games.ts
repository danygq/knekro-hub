// Game-library domain types.
// `GameListRow` is the slim projection actually loaded by `loadGames()`
// in `lib/games.ts`; `Game` is the full entity, aspirational until the `games`
// table is confirmed against Supabase.

/** Lookup row of game states (e.g. "En progreso"); drives the filter panel. */
export interface GameStatus {
  id: number;
  name: string;
  games_with_this_status: number;
}

export type GameSortOption =
  | "name_asc"
  | "name_desc"
  | "last_played_desc"
  | "last_played_asc"
  | "community_desc"
  | "community_asc"
  | "user_vote_desc"
  | "user_vote_asc";

/**
 * One row of the games grid: exactly the columns `/games` selects from
 * `games` (id, name, cover_url, vote_count, avg_vote) plus the embedded
 * `status` join. `vote_count`/`avg_vote` are maintained by the
 * `on_vote_change` trigger on `games_user_votes`.
 */
export interface GameDetails {
  id: number;
  name: string;
  cover_url: string | null;
  vote_count: number | null;
  avg_vote: number | null;
  status: GameStatus;
  game_status_id: number | null;
  user_vote?: UserVoteEmbed[] | null;
  twitch_game_id?: string | null;
  last_played_at?: string | null;
}

export interface UserVoteEmbed {
  vote: number;
}

export interface GamesUserVoteRow {
  id: number;
  created_at: string;
  user_id: string | null;
  game_id: number | null;
  vote: number | null;
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

/** Community average for a game, read from the DB-maintained `vote_count`/`avg_vote` columns on `games`. */
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
  twitch_game_id?: string | null;
  last_played_at?: string | null;
}

/** Row from the `tags` table. */
export interface Tag {
  id: number;
  name: string;
  created_at?: string;
  games_with_this_tag: number;
}

/** Junction row from the `games_tags` table. */
export interface GameTag {
  game_id: number;
  tag_id: number;
  created_at: string;
}

/** Single stream play history item returned by get_game_by_id RPC */
export interface GameRecentPlay {
  id: number;
  event_timestamp: string | null;
  created_at: string;
  category_name: string | null;
}

/** Composite payload for the game detail page (/games/[id]) */
export interface GameDetailPageData {
  id: number;
  name: string;
  cover_url: string | null;
  vote_count: number | null;
  avg_vote: number | null;
  game_status_id: number | null;
  status_name: string | null;
  twitch_game_id: string | null;
  last_played_at: string | null;
  user_vote: number | null;
  tags: string[];
  recent_plays: GameRecentPlay[];
}
