// Shared DOM update logic for the games-library voting UI.
// Used by both the click handler (games-vote.ts) and the realtime handler
// (games-realtime.ts) so the community-average rendering stays consistent.

import type { GameCardEls } from "../../types";

/** Map a vote value (1-10) to a badge CSS color class. */
export function voteClass(vote: number): string {
  if (vote < 3) return "knk-vote-red";
  if (vote < 5) return "knk-vote-orange";
  if (vote < 7) return "knk-vote-amber";
  if (vote < 9) return "knk-vote-green";
  return "knk-vote-blue";
}

/** Swap a badge's vote-color class. Pass null for the neutral muted state. */
export function applyVoteColor(el: HTMLElement, vote: number | null): void {
  const next = vote == null ? "knk-vote-muted" : voteClass(vote);
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
export function formatAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

/**
 * Recompute the displayed average after a vote change, optimistically.
 * Reads the previous state from the card's data-* attributes and writes
 * the new average + count back. Works for new votes, changed votes, and
 * cleared votes.
 */
export function updateAverage(card: GameCardEls, oldVote: number | null, newVote: number | null): void {
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
    if (card.avgLabel) card.avgLabel.textContent = `${formatAvg(nextAvg)}/10`;
    if (card.voteCount) {
      card.voteCount.textContent = `${nextCount} voto${nextCount > 1 ? "s" : ""}`;
      card.voteCount.hidden = false;
    }
    avgBadge.title = `Media de la comunidad (${nextCount} votos)`;
    applyVoteColor(avgBadge, nextAvg);
  } else {
    // no votes left — reset to empty state
    card.root.dataset.avg = "";
    card.root.dataset.avgCount = "0";
    if (card.avgLabel) card.avgLabel.textContent = "−/10";
    if (card.voteCount) card.voteCount.hidden = true;
    avgBadge.title = "Sin votos todavía";
    applyVoteColor(avgBadge, null);
  }
}

/**
 * Update the toggle button + number highlights to reflect the user's vote.
 */
export function reflectVote(card: GameCardEls, vote: number | null): void {
  card.root.dataset.vote = vote != null ? String(vote) : "";
  if (card.personalBadge) {
    card.personalBadge.hidden = vote == null;
    card.personalBadge.textContent = `Tu puntuación: ${vote}`;
    if (vote != null) applyVoteColor(card.personalBadge, vote);
  }

  card.picker.querySelectorAll<HTMLElement>("[data-vote-value]").forEach((btn) => {
    const n = Number(btn.dataset.voteValue);
    btn.classList.toggle("active", n === vote);
  });
}

/** Find a game card's DOM elements by game id. Returns null if not found. */
export function findCard(gameId: number): GameCardEls | null {
  const root = document.querySelector<HTMLElement>(`.knk-game-card[data-game-id="${gameId}"]`);
  if (!root) return null;
  return {
    root,
    toggle: root.querySelector<HTMLButtonElement>("[data-vote-toggle]")!,
    picker: root.querySelector<HTMLElement>("[data-vote-picker]")!,
    avgBadge: root.querySelector<HTMLElement>("[data-avg-badge]"),
    avgLabel: root.querySelector<HTMLElement>("[data-avg-label]"),
    voteCount: root.querySelector<HTMLElement>("[data-vote-count]"),
    personalBadge: root.querySelector<HTMLElement>("[data-personal-badge]"),
  };
}
