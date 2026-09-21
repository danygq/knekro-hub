// Server-side helpers + data loader for the games library (/games).
// Import this from an .astro frontmatter (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GameDetailPageData,
  GameDetails,
  GameRecentPlay,
  GameSortOption,
  GameStatus,
} from "@/types";
import type { Order } from "@/types/db.ts";

/** Format an average: whole numbers as integers, otherwise max 1 decimal. */
export function formatAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

export async function loadGameStatuses(
  client: SupabaseClient,
  order: Order = { field: "name", options: { ascending: true } },
): Promise<GameStatus[]> {
  const { data, error } = await client
    .from("game_status")
    .select("id, name, games_with_this_status")
    .order(order.field, order.options);
  if (error) {
    console.error("Error fetching game statuses:", error);
    return [];
  }
  return data as GameStatus[];
}

/**
 * Fetch a single game by id with tags, vote stats, user vote, and recent stream plays
 * using the atomic `get_game_by_id` Postgres RPC.
 */
export async function loadGameById(
  client: SupabaseClient,
  gameId: number,
  userId?: string,
): Promise<GameDetailPageData | null> {
  const { data, error } = await client
    .rpc("get_game_by_id", {
      p_game_id: gameId,
      p_user_id: userId ?? null,
    })
    .maybeSingle();

  if (error) {
    console.error("Error fetching game by id via RPC:", error);
    return null;
  }

  if (!data) return null;

  const raw = data as any;
  const rawPlays = raw.recent_plays;
  const recentPlays: GameRecentPlay[] = Array.isArray(rawPlays)
    ? rawPlays
    : typeof rawPlays === "string"
      ? JSON.parse(rawPlays)
      : [];

  return {
    id: Number(raw.id),
    name: raw.name,
    cover_url: raw.cover_url,
    vote_count: raw.vote_count != null ? Number(raw.vote_count) : null,
    avg_vote: raw.avg_vote != null ? Number(raw.avg_vote) : null,
    game_status_id:
      raw.game_status_id != null ? Number(raw.game_status_id) : null,
    status_name: raw.status_name ?? null,
    twitch_game_id: raw.twitch_game_id ?? null,
    last_played_at: raw.last_played_at ?? null,
    user_vote: raw.user_vote != null ? Number(raw.user_vote) : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    recent_plays: recentPlays,
  };
}

export interface FetchGamesParams {
  query?: string;
  includedStatusIds?: number[];
  excludedStatusIds?: number[];
  sort?: GameSortOption;
  offset?: number;
  limit?: number;
  userId?: string;
}

/**
 * Executes a single parameterized query via the `get_user_games` Postgres RPC,
 * supporting searching, status filtering, multi-column sorting (including personal user votes),
 * and DB-level pagination.
 */
export async function fetchGames(
  client: SupabaseClient,
  params: FetchGamesParams = {},
): Promise<{ games: GameDetails[]; total: number }> {
  const {
    query = "",
    includedStatusIds = [],
    excludedStatusIds = [],
    sort = "name_asc",
    offset = 0,
    limit = 24,
    userId,
  } = params;

  const { data, error } = await client.rpc("get_user_games", {
    p_user_id: userId ?? null,
    p_search: query,
    p_inc_status: includedStatusIds,
    p_exc_status: excludedStatusIds,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("Error fetching games via RPC:", error);
    return { games: [], total: 0 };
  }

  const rows = (data ?? []) as any[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const games: GameDetails[] = rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    cover_url: row.cover_url,
    vote_count: row.vote_count,
    avg_vote: row.avg_vote != null ? Number(row.avg_vote) : null,
    game_status_id:
      row.game_status_id != null ? Number(row.game_status_id) : null,
    status: row.status_name
      ? {
          id: Number(row.game_status_id),
          name: row.status_name,
          games_with_this_status: 0,
        }
      : { id: 0, name: "", games_with_this_status: 0 },
    user_vote: row.user_vote != null ? [{ vote: Number(row.user_vote) }] : [],
  }));

  return { games, total };
}
