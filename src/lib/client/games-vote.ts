// Browser controller for the games-library voting UI.
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Per-card interaction:
//   - "Votar" / "Tu puntuación: X" toggle reveals the 1-10 picker.
//   - Clicking a number submits the vote. Clicking the user's current number
//     again clears it (sends vote: null). The community average updates
//   -   optimistically from data-avg / data-avg-count so the UI feels instant.

interface CardEls {
  root: HTMLElement;
  toggle: HTMLButtonElement;
  picker: HTMLElement;
  avgBadge: HTMLElement | null;
}

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

/** Recompute the displayed average after a vote change, optimistically. */
function updateAverage(card: CardEls, oldVote: number | null, newVote: number | null): void {
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
    avgBadge.textContent = `${nextAvg.toFixed(1)}/10`;
    avgBadge.title = `Media de la comunidad (${nextCount} votos)`;
  } else {
    card.root.dataset.avg = "";
    card.root.dataset.avgCount = "0";
    avgBadge.textContent = "−/10";
    avgBadge.title = "Sin votos todavía";
  }
}

/** Reflect a confirmed vote on the toggle button + number highlights. */
function reflectVote(card: CardEls, vote: number | null): void {
  card.root.dataset.vote = vote != null ? String(vote) : "";
  card.toggle.textContent = vote != null ? `Tu puntuación: ${vote}` : "Votar";

  card.picker.querySelectorAll<HTMLElement>("[data-vote-value]").forEach((btn) => {
    const n = voteValue(btn);
    const active = n === vote;
    btn.classList.toggle("bg-(--knk-primary)", active);
    btn.classList.toggle("text-(--knk-primary-text)", active);
    btn.classList.toggle("border-(--knk-primary)", active);
    btn.classList.toggle("bg-(--knk-surface)", !active);
    btn.classList.toggle("text-(--knk-text-muted)", !active);
    btn.classList.toggle("border-(--knk-line)", !active);
  });
}

export function initGameVotes(): void {
  const cards = document.querySelectorAll<HTMLElement>(".knk-game-card");

  cards.forEach((root) => {
    const toggle = root.querySelector<HTMLButtonElement>("[data-vote-toggle]");
    const picker = root.querySelector<HTMLElement>("[data-vote-picker]");
    if (!toggle || !picker) return; // not logged in — no voting UI on this card

    const card: CardEls = { root, toggle, picker, avgBadge: root.querySelector<HTMLElement>("[data-avg-badge]") };

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
