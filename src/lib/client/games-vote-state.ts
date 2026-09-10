// Shared DOM update logic for the games-library voting UI.
// Used by the click handler (games-vote.ts) to render the user's own vote
// and to write freshly-fetched community averages back to the card.

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
 * Write a freshly-fetched community average + vote count to a card's DOM.
 * Pure rendering — no math. Call this after querying the real average
 * from the server so the card reflects the true community value.
 */
export function setCommunityAverage(card: GameCardEls, avg: number, count: number): void {
  const avgBadge = card.avgBadge;
  if (!avgBadge) return;

  if (count > 0) {
    card.root.dataset.avg = String(avg);
    card.root.dataset.avgCount = String(count);
    if (card.avgLabel) card.avgLabel.textContent = `${formatAvg(avg)}/10`;
    if (card.voteCount) {
      card.voteCount.textContent = `${count} voto${count > 1 ? "s" : ""}`;
      card.voteCount.hidden = false;
    }
    avgBadge.title = `Media de la comunidad (${count} votos)`;
    applyVoteColor(avgBadge, avg);
  } else {
    // no votes — reset to empty state
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
