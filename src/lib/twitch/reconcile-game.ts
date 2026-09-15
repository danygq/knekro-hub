import type { SupabaseClient } from "@supabase/supabase-js";
import { isIgnoredTwitchCategory, toMadridDateTimeString } from "./constants";
import { fetchSgdbCover } from "../steamgriddb";

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
 *    Also fetches a SteamGridDB cover when `cover_url` is null.
 * 3. Create New Game: If neither query yields a match, insert a new record with default `game_status_id = 11`.
 *    Immediately attempts a SteamGridDB cover fetch and writes `cover_url` if a match is found.
 */
export async function reconcileGame(
  supabaseAdmin: SupabaseClient,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): Promise<ReconcileGameResult> {
  const trimmedId = categoryId?.trim();
  const trimmedName = categoryName?.trim();

  // Guard: Skip if ID or Name is absent, invalid, or belongs to non-game/ignored categories
  if (
    !trimmedId ||
    !trimmedName ||
    trimmedId === "0" ||
    isIgnoredTwitchCategory(trimmedId)
  ) {
    const reason =
      !trimmedId || !trimmedName
        ? "missing ID or name"
        : trimmedId === "0"
          ? "category ID is 0"
          : "ignored category";
    console.log(
      `[Twitch Reconcile] Skipped: category="${trimmedName}" (id: ${trimmedId}) - reason: ${reason}`,
    );
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
    console.log(
      `[Twitch Reconcile] Game "${existingById.name}" already exists in database (twitch_game_id: ${trimmedId}, id: ${existingById.id}).`,
    );
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
      console.log(
        `[Twitch Reconcile] Matched existing game "${matchedByName.name}" (id: ${matchedByName.id}) by name. Backfilling twitch_game_id: ${trimmedId}...`,
      );
      const { data: updatedGame, error: updateError } = await supabaseAdmin
        .from("games")
        .update({ twitch_game_id: trimmedId })
        .eq("id", matchedByName.id)
        .select("id, name, twitch_game_id, game_status_id, cover_url")
        .single();

      if (updateError) {
        console.error(
          `[Twitch Reconcile] Failed to backfill twitch_game_id for "${matchedByName.name}":`,
          updateError,
        );
        return { action: "updated_by_name", game: matchedByName };
      }
      console.log(
        `[Twitch Reconcile] Successfully linked game "${matchedByName.name}" (id: ${matchedByName.id}) to twitch_game_id: ${trimmedId}.`,
      );

      // Attempt SteamGridDB cover fetch when cover_url is still null
      if (!updatedGame.cover_url) {
        console.log(
          `[Twitch Reconcile] cover_url is null for "${updatedGame.name}" (id: ${updatedGame.id}) — attempting SteamGridDB lookup...`,
        );
        try {
          const coverUrl = await fetchSgdbCover(updatedGame.name ?? "");
          if (coverUrl) {
            const { error: coverError } = await supabaseAdmin
              .from("games")
              .update({ cover_url: coverUrl })
              .eq("id", updatedGame.id);
            if (coverError) {
              console.error(
                `[Twitch Reconcile] Failed to set cover_url for "${updatedGame.name}" (id: ${updatedGame.id}):`,
                coverError,
              );
            } else {
              console.log(
                `[Twitch Reconcile] cover_url set for "${updatedGame.name}" (id: ${updatedGame.id}): ${coverUrl}`,
              );
            }
          } else {
            console.log(
              `[Twitch Reconcile] No SteamGridDB cover found for "${updatedGame.name}" (id: ${updatedGame.id}), cover_url left null.`,
            );
          }
        } catch (sgdbErr) {
          console.error(
            `[Twitch Reconcile] Unexpected error during SteamGridDB lookup for "${updatedGame.name}":`,
            sgdbErr,
          );
        }
      } else {
        console.log(
          `[Twitch Reconcile] cover_url already set for "${updatedGame.name}" (id: ${updatedGame.id}), skipping SteamGridDB lookup.`,
        );
      }

      return { action: "updated_by_name", game: updatedGame };
    }
    console.log(
      `[Twitch Reconcile] Matched existing game "${matchedByName.name}" (id: ${matchedByName.id}) by name, but it already has twitch_game_id: ${matchedByName.twitch_game_id}.`,
    );
    return { action: "matched_by_id", game: matchedByName };
  }

  // 3. Create New Game
  console.log(
    `[Twitch Reconcile] Game "${trimmedName}" (twitch_game_id: ${trimmedId}) not found in database. Inserting new game...`,
  );
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
    console.error(
      `[Twitch Reconcile] Failed to insert new game "${trimmedName}":`,
      insertError,
    );
    return { action: "created", game: null };
  }

  console.log(`Game ${newGame.name} was added to the database.`);

  // Attempt SteamGridDB cover fetch for the newly inserted game
  console.log(
    `[Twitch Reconcile] cover_url is null for new game "${newGame.name}" (id: ${newGame.id}) — attempting SteamGridDB lookup...`,
  );
  try {
    const coverUrl = await fetchSgdbCover(newGame.name ?? "");
    if (coverUrl) {
      const { error: coverError } = await supabaseAdmin
        .from("games")
        .update({ cover_url: coverUrl })
        .eq("id", newGame.id);
      if (coverError) {
        console.error(
          `[Twitch Reconcile] Failed to set cover_url for "${newGame.name}" (id: ${newGame.id}):`,
          coverError,
        );
      } else {
        console.log(
          `[Twitch Reconcile] cover_url set for "${newGame.name}" (id: ${newGame.id}): ${coverUrl}`,
        );
      }
    } else {
      console.log(
        `[Twitch Reconcile] No SteamGridDB cover found for "${newGame.name}" (id: ${newGame.id}), cover_url left null.`,
      );
    }
  } catch (sgdbErr) {
    console.error(
      `[Twitch Reconcile] Unexpected error during SteamGridDB lookup for "${newGame.name}":`,
      sgdbErr,
    );
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
  const timestamp = eventTimestamp || toMadridDateTimeString();
  const { data, error } = await supabaseAdmin
    .from("twitch_channel_update")
    .insert({
      event_timestamp: timestamp,
      category_id: categoryId?.trim() || null,
      category_name: categoryName?.trim() || null,
    })
    .select("id, category_id, category_name, event_timestamp")
    .single();

  if (error) {
    console.error(
      "[Twitch EventSub] Failed to insert twitch_channel_update:",
      error,
    );
  } else {
    console.log(
      `[Twitch ChannelUpdate] Recorded category update: "${categoryName}" (ID: ${categoryId}) at ${timestamp}`,
    );
  }
  return data;
}
