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
  Tag,
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

export async function loadTags(
  client: SupabaseClient,
  order: Order = { field: "name", options: { ascending: true } },
): Promise<Tag[]> {
  const { data, error } = await client
    .from("tags")
    .select("id, name, games_with_this_tag")
    .gt("games_with_this_tag", 0)
    .order(order.field, order.options);
  if (error) {
    console.error("Error fetching tags:", error);
    return [];
  }
  return data as Tag[];
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
  includedTagIds?: number[];
  excludedTagIds?: number[];
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
    includedTagIds = [],
    excludedTagIds = [],
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
    p_inc_tags: includedTagIds,
    p_exc_tags: excludedTagIds,
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

export interface UpdateGameStatusResult {
  success: boolean;
  error?: string;
  gameId: number;
  statusId: number;
  statusName: string;
}

/**
 * Updates a game's status and logs an immutable audit entry in `public.audit_logs`.
 * Strictly executed for website mutations by authorized owners and managers.
 */
export async function updateGameStatusWithAudit(
  client: SupabaseClient,
  actorId: string,
  gameId: number,
  newStatusId: number,
): Promise<UpdateGameStatusResult> {
  // 1. Fetch target game info and current status
  const { data: currentGame, error: fetchGameError } = await client
    .from("games")
    .select(
      "id, name, game_status_id, status:game_status!game_status_id(id, name)",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (fetchGameError || !currentGame) {
    console.error("Error fetching game for status update:", fetchGameError);
    return {
      success: false,
      error: "Juego no encontrado",
      gameId,
      statusId: newStatusId,
      statusName: "",
    };
  }

  // 2. Fetch new status details
  const { data: newStatus, error: fetchStatusError } = await client
    .from("game_status")
    .select("id, name")
    .eq("id", newStatusId)
    .maybeSingle();

  if (fetchStatusError || !newStatus) {
    console.error("Error fetching new game status:", fetchStatusError);
    return {
      success: false,
      error: "Estado no válido",
      gameId,
      statusId: newStatusId,
      statusName: "",
    };
  }

  const oldStatusId = currentGame.game_status_id;
  const oldStatusName =
    (currentGame.status as unknown as { name?: string } | null)?.name ?? null;

  // If status is already identical, no mutation needed
  if (oldStatusId === newStatusId) {
    return {
      success: true,
      gameId,
      statusId: newStatusId,
      statusName: newStatus.name,
    };
  }

  // 3. Update game status
  const { error: updateError } = await client
    .from("games")
    .update({ game_status_id: newStatusId })
    .eq("id", gameId);

  if (updateError) {
    console.error("Error updating game status in database:", updateError);
    return {
      success: false,
      error: "Error al actualizar el estado del juego",
      gameId,
      statusId: newStatusId,
      statusName: newStatus.name,
    };
  }

  // 4. Insert audit log row
  const description = oldStatusName
    ? `Estado de "${currentGame.name}" actualizado de "${oldStatusName}" a "${newStatus.name}"`
    : `Estado de "${currentGame.name}" establecido a "${newStatus.name}"`;

  const { error: auditError } = await client.from("audit_logs").insert({
    user_id: actorId,
    action_type: "UPDATE_GAME_STATUS",
    entity_type: "games",
    entity_id: gameId,
    old_value: { status_id: oldStatusId, status_name: oldStatusName },
    new_value: { status_id: newStatusId, status_name: newStatus.name },
    description,
  });

  if (auditError) {
    console.error("Error creating audit log entry:", auditError);
  }

  return {
    success: true,
    gameId,
    statusId: newStatusId,
    statusName: newStatus.name,
  };
}
