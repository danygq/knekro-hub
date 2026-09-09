// Realtime subscription for the games-library voting UI.
// Listens to INSERT/UPDATE events on `games_user_votes` and updates the
// affected game card's community average optimistically.
//
// Works alongside games-vote.ts: when the current user votes, the optimistic
// update in games-vote.ts fires first; the realtime event for that same vote
// is skipped via the shared `justVotedGames` Set.

import type { GameCardEls } from "../../types";
import { supabaseClient } from "../db-client";
import { updateAverage, findCard } from "./games-vote-state";

/** Games the current user just voted on — skip their realtime events. */
export const justVotedGames = new Set<number>();

/**
 * Subscribe to vote changes on `games_user_votes` and update cards live.
 * Returns an unsubscribe function for cleanup on navigation.
 */
export function initGameRealtime(): () => void {
  const channel = supabaseClient
    .channel("game-votes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "games_user_votes" },
      (payload) => handleVoteChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "games_user_votes" },
      (payload) => handleVoteChange(payload),
    )
    .subscribe();

  return () => {
    supabaseClient.removeChannel(channel);
  };
}

function handleVoteChange(payload: { new: { game_id?: number; vote?: number | null }; old?: { vote?: number | null } }): void {
  const { game_id: gameId, vote: newVote } = payload.new;
  if (gameId == null) return;

  // Skip if the current user just voted on this game (optimistic update already applied)
  if (justVotedGames.has(gameId)) {
    justVotedGames.delete(gameId);
    return;
  }

  const card: GameCardEls | null = findCard(gameId);
  if (!card) return;

  const oldVote = payload.old?.vote ?? null;
  updateAverage(card, oldVote, newVote ?? null);
}
