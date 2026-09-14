import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReconcileGameResult {
  action: "matched_by_id" | "updated_by_name" | "created" | "skipped";
  game?: {
    id: number;
    name: string | null;
    twitch_game_id: string | null;
    game_status_id: number | null;
  } | null;
}

/**
 * Reconciles a game played on Twitch with the `public.games` table:
 * 1. Lookup by `twitch_game_id`: Check if a game exists with `twitch_game_id = category_id`.
 * 2. Fallback Lookup by `name` (case-insensitive): If not found by ID, query `games` via `.ilike('name', category_name)`.
 *    If found with `twitch_game_id IS NULL`, update the existing record to backfill `twitch_game_id`.
 * 3. Create New Game: If neither query yields a match, insert a new record with default `game_status_id = 11`.
 */
export async function reconcileGame(
  supabaseAdmin: SupabaseClient,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): Promise<ReconcileGameResult> {
  const trimmedId = categoryId?.trim();
  const trimmedName = categoryName?.trim();

  // Guard: Skip if ID or Name is absent or invalid
  if (!trimmedId || !trimmedName || trimmedId === "0") {
    return { action: "skipped" };
  }

  // 1. Lookup by twitch_game_id
  const { data: existingById, error: idError } = await supabaseAdmin
    .from("games")
    .select("id, name, twitch_game_id, game_status_id")
    .eq("twitch_game_id", trimmedId)
    .maybeSingle();

  if (idError) {
    console.error(
      "[Twitch Reconcile] Error looking up game by twitch_game_id:",
      idError,
    );
  }

  if (existingById) {
    return { action: "matched_by_id", game: existingById };
  }

  // 2. Fallback Lookup by name (Case-Insensitive)
  const { data: matchedByName, error: nameError } = await supabaseAdmin
    .from("games")
    .select("id, name, twitch_game_id, game_status_id")
    .ilike("name", trimmedName)
    .limit(1)
    .maybeSingle();

  if (nameError) {
    console.error(
      "[Twitch Reconcile] Error looking up game by name:",
      nameError,
    );
  }

  if (matchedByName) {
    if (!matchedByName.twitch_game_id) {
      const { data: updatedGame, error: updateError } = await supabaseAdmin
        .from("games")
        .update({ twitch_game_id: trimmedId })
        .eq("id", matchedByName.id)
        .select("id, name, twitch_game_id, game_status_id")
        .single();

      if (updateError) {
        console.error(
          "[Twitch Reconcile] Failed to backfill twitch_game_id:",
          updateError,
        );
        return { action: "updated_by_name", game: matchedByName };
      }
      return { action: "updated_by_name", game: updatedGame };
    }
    return { action: "matched_by_id", game: matchedByName };
  }

  // 3. Create New Game
  const { data: newGame, error: insertError } = await supabaseAdmin
    .from("games")
    .insert({
      name: trimmedName,
      twitch_game_id: trimmedId,
      game_status_id: 11,
    })
    .select("id, name, twitch_game_id, game_status_id")
    .single();

  if (insertError) {
    console.error("[Twitch Reconcile] Failed to insert new game:", insertError);
    return { action: "created", game: null };
  }

  return { action: "created", game: newGame };
}

/**
 * Persists a channel update event into `public.twitch_channel_update`.
 */
export async function recordChannelUpdate(
  supabaseAdmin: SupabaseClient,
  eventTimestamp: string | null | undefined,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
) {
  const { data, error } = await supabaseAdmin
    .from("twitch_channel_update")
    .insert({
      event_timestamp: eventTimestamp || new Date().toISOString(),
      category_id: categoryId?.trim() || null,
      category_name: categoryName?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "[Twitch EventSub] Failed to insert twitch_channel_update:",
      error,
    );
  }
  return data;
}
