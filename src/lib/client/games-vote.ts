// Browser controller for the games-library voting UI.
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Per-card interaction:
//   - "Votar" / "Tu puntuación: X" toggle reveals the 1-10 picker.
//   - Clicking a number submits the vote via the browser Supabase client.
//     Clicking the user's current number again clears it (sets vote: null).
//   - The personal vote reflects instantly; the community average is then
//     re-fetched from the server for that game so the card shows the true value.

import type { GameCardEls } from "../../types";
import { supabaseClient } from "../db-client";
import { reflectVote, setCommunityAverage } from "./games-vote-state";

function voteValue(btn: HTMLElement): number {
  return Number(btn.dataset.voteValue);
}

/** Close every open picker except the one on `current` (optionally). */
function closeAllPickers(current?: HTMLElement): void {
  document
    .querySelectorAll<HTMLElement>("[data-vote-picker]")
    .forEach((picker) => {
      if (picker === current) return;
      picker.hidden = true;
    });
}

/** Submit a vote (or clear it) directly via the browser Supabase client. */
async function submitVote(
  gameId: number,
  vote: number | null,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return false;

  // Upsert on (user_id, game_id): inserts a new row or updates the existing one.
  // A null vote clears the user's vote (row is kept, vote column set to null).
  const { error } = await supabaseClient
    .from("games_user_votes")
    .upsert(
      { user_id: user.id, game_id: gameId, vote },
      { onConflict: "user_id,game_id" },
    );

  return !error;
}

/**
 * Fetch the real community average + vote count for a single game from the
 * DB-maintained `vote_count`/`avg_vote` columns on `games`. Returns null if
 * the game has no votes (or on error).
 */
async function fetchCommunityAverage(
  gameId: number,
): Promise<{ avg: number; count: number } | null> {
  const { data, error } = await supabaseClient
    .from("games")
    .select("vote_count, avg_vote")
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching community average:", error);
    return null;
  }

  const count = data?.vote_count ?? 0;
  const avg = data?.avg_vote ?? null;
  if (count <= 0 || avg == null) return null;

  return { avg, count };
}

/**
 * Build the GameCardEls lookup for a card root. Returns null when the card has
 * no voting UI (user not logged in).
 */
function getCardEls(root: HTMLElement): GameCardEls | null {
  const toggle = root.querySelector<HTMLButtonElement>("[data-vote-toggle]");
  const picker = root.querySelector<HTMLElement>("[data-vote-picker]");
  if (!toggle || !picker) return null;
  return {
    root,
    toggle,
    picker,
    avgBadge: root.querySelector<HTMLElement>("[data-avg-badge]"),
    avgLabel: root.querySelector<HTMLElement>("[data-avg-label]"),
    voteCount: root.querySelector<HTMLElement>("[data-vote-count]"),
    personalBadge: root.querySelector<HTMLElement>("[data-personal-badge]"),
  };
}

export function initGameVotes(): () => void {
  // Event delegation: one document-level handler resolves the card via
  // closest(), so voting works for every card regardless of when it was added
  // (SSR, search results, future lazy-loaded pages). This is essential because
  // the grid controller replaces card elements on every render.
  const handleClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // 1. A vote number was clicked — submit (or clear) the vote.
    const numBtn = target.closest<HTMLElement>("[data-vote-value]");
    if (numBtn) {
      const root = numBtn.closest<HTMLElement>(".knk-game-card");
      if (!root) return;
      const card = getCardEls(root);
      if (!card) return;
      e.stopPropagation();

      const value = voteValue(numBtn);
      const currentVote = root.dataset.vote ? Number(root.dataset.vote) : null;
      const nextVote = value === currentVote ? null : value;
      const gameId = Number(root.dataset.gameId);

      // instant personal feedback
      reflectVote(card, nextVote);
      card.picker.hidden = true;

      const ok = await submitVote(gameId, nextVote);
      if (!ok) {
        reflectVote(card, currentVote); // revert on failure
        console.error("Vote failed");
        return;
      }

      // fetch the real community average and update the card
      const community = await fetchCommunityAverage(gameId);
      setCommunityAverage(
        card,
        community ? community.avg : 0,
        community ? community.count : 0,
      );
      return;
    }

    // 2. The "Votar" toggle was clicked — reveal / hide this card's picker.
    const toggle = target.closest<HTMLButtonElement>("[data-vote-toggle]");
    if (toggle) {
      const root = toggle.closest<HTMLElement>(".knk-game-card");
      if (!root) return;
      const card = getCardEls(root);
      if (!card) return;
      e.stopPropagation();
      const willOpen = card.picker.hidden;
      closeAllPickers(card.picker);
      card.picker.hidden = !willOpen;
      return;
    }

    // 3. The card body was clicked (mobile-friendly) — toggle the picker.
    //    Ignore clicks landing on the picker itself (its numbers are handled above).
    const root = target.closest<HTMLElement>(".knk-game-card");
    if (root && !target.closest("[data-vote-picker]")) {
      const card = getCardEls(root);
      if (!card) return;
      e.stopPropagation();
      const willOpen = card.picker.hidden;
      closeAllPickers(card.picker);
      card.picker.hidden = !willOpen;
      return;
    }

    // 4. Click was outside any card — close all open pickers.
    closeAllPickers();
  };

  // close on Escape
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeAllPickers();
  };
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", keyHandler);

  // cleanup function for view transitions
  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", keyHandler);
  };
}
