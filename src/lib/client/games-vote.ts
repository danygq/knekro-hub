// Browser controller for the games-library voting UI.
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Per-card interaction:
//   - "Votar" / "Tu puntuación: X" toggle reveals the 1-10 picker.
//   - Clicking a number submits the vote via the browser Supabase client.
//     Clicking the user's current number again clears it (sets vote: null).
//   - The community average updates optimistically from data-avg / data-avg-count.
//   - Votes from OTHER users arrive via the realtime subscription
//     (games-realtime.ts) and update the average live.

import type { GameCardEls } from "../../types";
import { supabaseClient } from "../db-client";
import { updateAverage, reflectVote } from "./games-vote-state";
import { justVotedGames } from "./games-realtime";

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

        // optimistic UI
        reflectVote(card, nextVote);
        updateAverage(card, currentVote, nextVote);
        picker.hidden = true;

        // flag this game so the realtime event doesn't double-count
        justVotedGames.add(gameId);
        setTimeout(() => justVotedGames.delete(gameId), 1000);

        const ok = await submitVote(gameId, nextVote);
        if (!ok) {
          // revert optimistic change on failure
          reflectVote(card, currentVote);
          updateAverage(card, nextVote, currentVote);
          console.error("Vote failed");
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
