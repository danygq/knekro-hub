// Server-side helpers + data loaders for Rankings (/ranking).
// Import this from .astro frontmatter or API routes (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameDetails, RankingCategory } from "@/types";
import { fetchGames } from "./games";

export interface RankingGameItem {
  id: number;
  user_id: string;
  year: number;
  category_id: number;
  game_id: number;
  rank: number; // 1 = Gold, 2 = Silver, 3 = Bronze
  game: {
    id: number;
    name: string;
    cover_url: string | null;
    avg_vote: number | null;
    vote_count: number | null;
    status: { id: number; name: string } | null;
  } | null;
}

/**
 * Loads all ranking categories ordered by ID.
 */
export async function loadRankingCategories(
  client: SupabaseClient,
): Promise<RankingCategory[]> {
  const { data, error } = await client
    .from("ranking_categories")
    .select("id, name, slug, description, cover_url, created_at")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching ranking categories:", error);
    return [];
  }

  return (data as RankingCategory[]) ?? [];
}

/**
 * Loads a single ranking category by its URL slug.
 */
export async function loadRankingCategoryBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<RankingCategory | null> {
  const { data, error } = await client
    .from("ranking_categories")
    .select("id, name, slug, description, cover_url, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching category with slug "${slug}":`, error);
    return null;
  }

  return (data as RankingCategory | null) ?? null;
}

/**
 * Loads top 3 podium items (Gold = 1, Silver = 2, Bronze = 3) for a category, year, and user.
 */
export async function loadPodiumGames(
  client: SupabaseClient,
  categoryId: number,
  year: number,
  userId?: string,
): Promise<RankingGameItem[]> {
  let query = client
    .from("ranking_items")
    .select(
      "id, user_id, year, category_id, game_id, rank, game:games!game_id(id, name, cover_url, avg_vote, vote_count, status:game_status!game_status_id(id, name))",
    )
    .eq("category_id", categoryId)
    .eq("year", year)
    .in("rank", [1, 2, 3]);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.order("rank", { ascending: true });

  if (error) {
    console.error(
      `Error fetching podium for category ${categoryId}, year ${year}:`,
      error,
    );
    return [];
  }

  return (data as unknown as RankingGameItem[]) ?? [];
}

/**
 * Searches and paginates games for the ranking assignable pool.
 * Delegates to {@link fetchGames} (backed by the `get_user_games` RPC) so that
 * both the catalog and ranking search surfaces share a single database round
 * trip instead of the previous two-stage countQuery + gamesQuery waterfall.
 */
export async function loadRankingSearchGames(
  client: SupabaseClient,
  options: {
    query?: string;
    offset?: number;
    limit?: number;
  } = {},
): Promise<{ games: GameDetails[]; total: number }> {
  const { query = "", offset = 0, limit = 24 } = options;
  return fetchGames(client, { query, offset, limit, sort: "name_asc" });
}

/**
 * Assigns a game to a podium rank (1 = Gold, 2 = Silver, 3 = Bronze) for a given category, year, and user.
 * Handles removing any existing game in that rank or moving the game if already placed.
 */
export async function assignPodiumGame(
  client: SupabaseClient,
  params: {
    categoryId: number;
    gameId: number;
    rank: number;
    year: number;
    userId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const { categoryId, gameId, rank, year, userId } = params;

  if (![1, 2, 3].includes(rank)) {
    return {
      success: false,
      error: "El rango debe ser 1 (Oro), 2 (Plata) o 3 (Bronce).",
    };
  }

  // 1. Check if the game is already placed by this user in this podium
  const { data: existingGamePlacement } = await client
    .from("ranking_items")
    .select("id, rank")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .eq("year", year)
    .eq("game_id", gameId)
    .maybeSingle();

  // 2. Check if another game occupies target rank for this user
  const { data: existingRankItem } = await client
    .from("ranking_items")
    .select("id, game_id")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .eq("year", year)
    .eq("rank", rank)
    .maybeSingle();

  // If this game already is at this rank, nothing to do
  if (existingGamePlacement && existingGamePlacement.rank === rank) {
    return { success: true };
  }

  // If another game is at target rank and this game was elsewhere in the podium, swap them
  if (existingRankItem && existingGamePlacement) {
    const oldRank = existingGamePlacement.rank;
    await client.from("ranking_items").delete().eq("id", existingRankItem.id);

    await client
      .from("ranking_items")
      .update({ rank })
      .eq("id", existingGamePlacement.id);

    await client.from("ranking_items").insert({
      user_id: userId,
      year,
      category_id: categoryId,
      game_id: existingRankItem.game_id,
      rank: oldRank,
    });

    return { success: true };
  }

  // If another game is at target rank and this is a fresh game from grid, replace the occupant
  if (existingRankItem) {
    await client.from("ranking_items").delete().eq("id", existingRankItem.id);
  }

  // If this game was already in another rank, update its rank
  if (existingGamePlacement) {
    const { error } = await client
      .from("ranking_items")
      .update({ rank })
      .eq("id", existingGamePlacement.id);

    if (error) {
      console.error("Error moving podium game:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  // Insert fresh assignment
  const { error } = await client.from("ranking_items").insert({
    user_id: userId,
    year,
    category_id: categoryId,
    game_id: gameId,
    rank,
  });

  if (error) {
    console.error("Error assigning podium game:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Removes a game from a podium slot for a given category, year, and user.
 */
export async function removePodiumGame(
  client: SupabaseClient,
  params: {
    categoryId: number;
    rank: number;
    year: number;
    userId: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const { categoryId, rank, year, userId } = params;

  const { error } = await client
    .from("ranking_items")
    .delete()
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .eq("year", year)
    .eq("rank", rank);

  if (error) {
    console.error("Error removing game from podium:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
