// Server-side helpers + data loader for the games library (/games).
// Import this from an .astro frontmatter (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameListRow, GameStatus } from "../types";
import type { Order } from "../types/db.ts";

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

export async function loadGames(
  client: SupabaseClient,
  userId?: string,
  order: Order = { field: "id", options: { ascending: true } },
  limit = 2,
): Promise<GameListRow[]> {
  let selectFields =
    "id, name, cover_url, vote_count, avg_vote, status:game_status!game_status_id(id, name),game_status_id";
  if (userId) {
    selectFields += ", user_vote:games_user_votes(vote)";
  }
  let query = client
    .from("games")
    .select(selectFields)
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
  return data as unknown as GameListRow[];
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
