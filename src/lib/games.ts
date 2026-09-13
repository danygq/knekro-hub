// Server-side helpers + data loader for the games library (/games).
// Import this from an .astro frontmatter (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameDetails, GameStatus } from "@/types";
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
 * Select string shared by {@link loadGames} and {@link loadGameById}:
 * the slim projection the grid renders (DB-maintained avg/count columns +
 * the embedded status join). `game_status_id` is included so the client can
 * filter cards by status without a second query.
 */
function gamesSelectFields(userId?: string): string {
  let fields =
    "id, name, cover_url, vote_count, avg_vote, status:game_status!game_status_id(id, name), game_status_id";
  if (userId) {
    fields += ", user_vote:games_user_votes(vote)";
  }
  return fields;
}

export async function loadGames(
  client: SupabaseClient,
  userId?: string,
  order: Order = { field: "id", options: { ascending: true } },
  limit = 24,
): Promise<GameDetails[]> {
  let query = client
    .from("games")
    .select(gamesSelectFields(userId))
    .order(order.field, order.options)
    .limit(limit);
  if (userId) {
    query = query.eq("games_user_votes.user_id", userId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching games:", error);
    return [];
  }
  return data as unknown as GameDetails[];
}

/** Fetch a single game by id with the same projection as {@link loadGames}. */
export async function loadGameById(
  client: SupabaseClient,
  gameId: number,
  userId?: string,
): Promise<GameDetails | null> {
  let query = client
    .from("games")
    .select(gamesSelectFields(userId))
    .eq("id", gameId);
  if (userId) {
    query = query.eq("games_user_votes.user_id", userId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Error fetching game by id:", error);
    return null;
  }
  return (data as GameDetails | null) ?? null;
}

export async function loadTotalGamesCount(
  client: SupabaseClient,
): Promise<number> {
  const { count, error } = await client
    .from("games")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("Error counting games:", error);
    return 0;
  }
  return count as number;
}
