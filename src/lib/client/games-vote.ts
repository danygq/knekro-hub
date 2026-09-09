// Browser controller for the games-library voting UI.
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Per-card interaction:
//   - "Votar" / "Tu puntuación: X" toggle reveals the 1-10 picker.
//   - Clicking a number submits the vote. Clicking the user's current number
//     again clears it (sends vote: null). The community average updates
//   -   optimistically from data-avg / data-avg-count so the UI feels instant.

import type { GameCardEls } from "../../types";

function voteValue(btn: HTMLElement): number {
  return Number(btn.dataset.voteValue);
}

// Mirror of the server-side voteClass(): map a vote (1-10) to a badge color class.
function voteClassClient(vote: number): string {
  if (vote < 3) return "knk-vote-red";
  if (vote < 5) return "knk-vote-orange";
  if (vote < 7) return "knk-vote-amber";
  if (vote < 9) return "knk-vote-green";
  return "knk-vote-blue";
}

// Swap a badge's vote-color class. Pass null for the neutral muted state.
function applyVoteColor(el: HTMLElement, vote: number | null): void {
  const next = vote == null ? "knk-vote-muted" : voteClassClient(vote);
  el.classList.remove(
    "knk-vote-red",
    "knk-vote-orange",
    "knk-vote-amber",
    "knk-vote-green",
    "knk-vote-blue",
    "knk-vote-muted",
  );
  el.classList.add(next);
}

/** Format an average: whole numbers as integers, otherwise max 1 decimal. */
function formatAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

/** Close every open picker except the one on `current` (optionally). */
function closeAllPickers(current?: HTMLElement): void {
  document.querySelectorAll<HTMLElement>("[data-vote-picker]").forEach((picker) => {
    if (picker === current) return;
    picker.hidden = true;
  });
}

/** Recompute the displayed average after a vote change, optimistically. */
function updateAverage(card: GameCardEls, oldVote: number | null, newVote: number | null): void {
  const avgBadge = card.avgBadge;
  if (!avgBadge) return;

  const prevAvg = Number(card.root.dataset.avg);
  const prevCount = Number(card.root.dataset.avgCount);
  const hasPrev = card.root.dataset.avg !== "" && prevCount > 0;

  let nextAvg: number | null = null;
  let nextCount = prevCount;

  if (oldVote === null && newVote !== null) {
    // new vote
    nextCount = prevCount + 1;
    nextAvg = hasPrev ? (prevAvg * prevCount + newVote) / nextCount : newVote;
  } else if (oldVote !== null && newVote !== null) {
    // changed vote — count unchanged
    nextCount = prevCount;
    nextAvg = hasPrev ? (prevAvg * prevCount - oldVote + newVote) / prevCount : newVote;
  } else if (oldVote !== null && newVote === null) {
    // cleared vote
    nextCount = prevCount - 1;
    if (nextCount > 0 && hasPrev) {
      nextAvg = (prevAvg * prevCount - oldVote) / nextCount;
    }
  }

  if (nextAvg !== null && nextCount > 0) {
    card.root.dataset.avg = String(nextAvg);
    card.root.dataset.avgCount = String(nextCount);
    avgBadge.textContent = `${formatAvg(nextAvg)}/10`;
    avgBadge.title = `Media de la comunidad (${nextCount} votos)`;
    applyVoteColor(avgBadge, nextAvg);
  } else {
    card.root.dataset.avg = "";
    card.root.dataset.avgCount = "0";
    avgBadge.textContent = "−/10";
    avgBadge.title = "Sin votos todavía";
    applyVoteColor(avgBadge, null);
  }
}

/** Reflect a confirmed vote on the toggle button + number highlights. */
function reflectVote(card: GameCardEls, vote: number | null): void {
  card.root.dataset.vote = vote != null ? String(vote) : "";
  if (card.personalBadge) {
    card.personalBadge.hidden = vote == null;
    card.personalBadge.textContent = `Tu puntuación: ${vote}`;
    if (vote != null) applyVoteColor(card.personalBadge, vote);
  }

  card.picker.querySelectorAll<HTMLElement>("[data-vote-value]").forEach((btn) => {
    const n = voteValue(btn);
    btn.classList.toggle("active", n === vote);
  });
}

export function initGameVotes(): void {
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

        // optimistic UI
        reflectVote(card, clearing ? null : value);
        updateAverage(card, currentVote, clearing ? null : value);
        picker.hidden = true;

        try {
          const res = await fetch("/api/games/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game_id: Number(root.dataset.gameId), vote: clearing ? null : value }),
          });
          if (!res.ok) {
            // revert optimistic change on failure
            reflectVote(card, currentVote);
            updateAverage(card, clearing ? null : value, currentVote);
            console.error("Vote failed", await res.text());
          }
        } catch (err) {
          reflectVote(card, currentVote);
          updateAverage(card, clearing ? null : value, currentVote);
          console.error("Vote error", err);
        }
      });
    });
  });

  // close pickers on outside click
  document.addEventListener("click", () => closeAllPickers());
  // close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPickers();
  });
}
