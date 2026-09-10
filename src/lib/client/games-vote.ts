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
import { setCommunityAverage, reflectVote } from "./games-vote-state";

function voteValue(btn: HTMLElement): number {
  return Number(btn.dataset.voteValue);
}

/** Close every open picker except the one on `current` (optionally). */
function closeAllPickers(current?: HTMLElement): void {
  document.querySelectorAll<HTMLElement>("[data-vote-picker]").forEach((picker) => {
    if (picker === current) return;
    picker.hidden = true;
  });
}

/** Submit a vote (or clear it) directly via the browser Supabase client. */
async function submitVote(gameId: number, vote: number | null): Promise<boolean> {
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
 * server. Returns null if the game has no votes (or on error).
 */
async function fetchCommunityAverage(gameId: number): Promise<{ avg: number; count: number } | null> {
  const { data, error } = await supabaseClient
    .from("games_user_votes")
    .select("vote")
    .eq("game_id", gameId)
    .not("vote", "is", null);

  if (error) {
    console.error("Error fetching community average:", error);
    return null;
  }

  const votes = (data as { vote: number }[] | null) ?? [];
  if (votes.length === 0) return null;

  const sum = votes.reduce((acc, row) => acc + row.vote, 0);
  return { avg: sum / votes.length, count: votes.length };
}

export function initGameVotes(): () => void {
  const cards = document.querySelectorAll<HTMLElement>(".knk-game-card");

  cards.forEach((root) => {
    const toggle = root.querySelector<HTMLButtonElement>("[data-vote-toggle]");
    const picker = root.querySelector<HTMLElement>("[data-vote-picker]");
    if (!toggle || !picker) return; // not logged in — no voting UI on this card

    const card: GameCardEls = {
      root,
      toggle,
      picker,
      avgBadge: root.querySelector<HTMLElement>("[data-avg-badge]"),
      avgLabel: root.querySelector<HTMLElement>("[data-avg-label]"),
      voteCount: root.querySelector<HTMLElement>("[data-vote-count]"),
      personalBadge: root.querySelector<HTMLElement>("[data-personal-badge]"),
    };

    // clicking the card opens the picker (mobile-friendly)
    root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-vote-toggle]") || target.closest("[data-vote-picker]")) return;
      e.stopPropagation();
      const willOpen = picker.hidden;
      closeAllPickers(picker);
      picker.hidden = !willOpen;
    });

    // toggle reveals / hides this card's picker
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = picker.hidden;
      closeAllPickers(picker);
      picker.hidden = !willOpen;
    });

    // a number is clicked — vote or clear
    picker.querySelectorAll<HTMLElement>("[data-vote-value]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const value = voteValue(btn);
        const currentVote = root.dataset.vote ? Number(root.dataset.vote) : null;
        const clearing = value === currentVote;

        const nextVote = clearing ? null : value;
        const gameId = Number(root.dataset.gameId);

        // instant personal feedback
        reflectVote(card, nextVote);
        picker.hidden = true;

        const ok = await submitVote(gameId, nextVote);
        if (!ok) {
          // revert personal vote on failure
          reflectVote(card, currentVote);
          console.error("Vote failed");
          return;
        }

        // fetch the real community average for this game and update the card
        const community = await fetchCommunityAverage(gameId);
        if (community) {
          setCommunityAverage(card, community.avg, community.count);
        } else {
          setCommunityAverage(card, 0, 0);
        }
      });
    });
  });

  // close pickers on outside click
  const outsideClick = () => closeAllPickers();
  document.addEventListener("click", outsideClick);

  // close on Escape
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeAllPickers();
  };
  document.addEventListener("keydown", keyHandler);

  // cleanup function for view transitions
  return () => {
    document.removeEventListener("click", outsideClick);
    document.removeEventListener("keydown", keyHandler);
  };
}
