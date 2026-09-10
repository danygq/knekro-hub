// Browser controller for the games library grid: global DB name search,
// pagination (the hook future infinite-scroll will call), card rendering, and
// the results counter.
//
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Search is server-side: keystrokes hit /api/games/search (which queries the
// DB with `ilike`), so a search sees the whole library, not just the cards
// already rendered. The search term lives here in the grid controller, so it
// survives every page fetch — when lazy loading lands, each new page is
// fetched with the same term still applied.
//
// The status filter (games-filter.ts) composes on top: it toggles card
// visibility and calls `recalc()` to refresh the counter.

import type { GameListRow, GameStatusRefOrList } from "../../types";

/** Format an average: whole numbers as integers, otherwise max 1 decimal. */
function formatAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

/** Map a vote value (1-10) to a badge CSS color class. */
function voteClass(vote: number): string {
  if (vote < 3) return "knk-vote-red";
  if (vote < 5) return "knk-vote-orange";
  if (vote < 7) return "knk-vote-amber";
  if (vote < 9) return "knk-vote-green";
  return "knk-vote-blue";
}

/** Map a number button (1-10) to its picker color class. */
function voteNumClass(n: number): string {
  if (n < 3) return "knk-vote-num-red";
  if (n < 5) return "knk-vote-num-orange";
  if (n < 7) return "knk-vote-num-amber";
  if (n < 9) return "knk-vote-num-green";
  return "knk-vote-num-blue";
}

/** First status name from the embedded join (badge text). */
function statusName(status: GameStatusRefOrList | undefined): string {
  if (!status) return "";
  const refs = Array.isArray(status) ? status : [status];
  return refs[0]?.name ?? "";
}

/** Space-separated status ids for the `data-status-ids` attribute. */
function statusIdString(status: GameStatusRefOrList | undefined): string {
  if (!status) return "";
  const refs = Array.isArray(status) ? status : [status];
  return refs.map((ref) => String(ref.id)).join(" ");
}

interface GameCardProps {
  name: string;
  coverUrl: string | null;
  status: string;
  statusIds: string;
  gameId: number;
  communityAvg: number | null;
  voteCount: number;
  userVote: number | null;
  loggedIn: boolean;
}

/** Build the markup for one card. Mirrors GameCard.astro — keep in sync. */
function renderCard(p: GameCardProps): string {
  const avgLabel = p.communityAvg != null ? formatAvg(p.communityAvg) : "−";
  const hasVote = p.userVote != null;
  const voteCls = p.userVote != null ? voteClass(p.userVote) : "";
  const avgCls =
    p.communityAvg != null ? voteClass(p.communityAvg) : "knk-vote-muted";
  const avgTitle =
    p.voteCount > 0
      ? `Media de la comunidad (${p.voteCount} votos)`
      : "Sin votos todavía";
  const voteCountHidden = p.voteCount === 0 ? " hidden" : "";
  const voteCountText = `${p.voteCount} voto${p.voteCount > 1 ? "s" : ""}`;

  const cover = p.coverUrl
    ? `<img src="${p.coverUrl}" alt="${p.name} cover" width="360" height="540" loading="lazy" decoding="async" class="absolute inset-0 h-full w-full object-cover" />`
    : `<div class="absolute inset-0 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="text-(--knk-text-faint)">
          <path d="M7 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1l-1.5-2h-5L8 17H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5" />
          <path d="M9.5 11.5v2M8.5 12.5h2M16 11h.01M14.5 12.5h.01" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>`;

  const statusBadge = p.status
    ? `<span class="absolute top-3 right-3 z-10 knk-notch-sm px-2.5 py-1 text-sm font-medium bg-(--knk-bg)/80 text-(--knk-text-muted) border border-(--knk-line)">${p.status}</span>`
    : "";

  const personalBadge = `<span data-personal-badge class="knk-notch-sm px-2.5 py-1 text-sm font-medium border tabular-nums text-shadow-[0_0_1px_var(--knk-line)] transition-colors ${voteCls}" title="Tu voto" ${hasVote ? "" : "hidden"}>Tu puntuación: ${p.userVote}</span>`;

  const avgBadge = `<span data-avg-badge class="ml-auto knk-notch-sm px-2.5 py-1.5 font-medium border tabular-nums text-shadow-[0_0_1px_var(--knk-line)] transition-colors ${avgCls}" title="${avgTitle}">
      <span class="flex flex-col items-center leading-tight">
        <span data-avg-label class="text-sm">${avgLabel}/10</span>
        <span data-vote-count class="text-[10px] font-normal"${voteCountHidden}>${voteCountText}</span>
      </span>
    </span>`;

  const voteUI = p.loggedIn
    ? `<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 p-3">
        <button type="button" data-vote-toggle class="knk-vote-toggle knk-notch-sm w-full px-3 py-2 text-sm font-medium bg-(--knk-bg)/85 text-(--knk-text-muted) border border-(--knk-line) opacity-0 group-hover:opacity-100 transition-opacity hover:text-(--knk-primary) hover:border-(--knk-line-strong)">
          Votar
        </button>
      </div>
      <div data-vote-picker hidden class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-(--knk-bg)/85 backdrop-blur-sm">
        <span class="text-sm font-medium text-(--knk-text-muted)">¿Cuál es tu puntuación?</span>
        <div class="grid grid-cols-5 gap-2">
          ${Array.from({ length: 10 }, (_, i) => i + 1)
            .map((n) => {
              const numCls = `${voteNumClass(n)} knk-vote-num knk-notch-sm w-11 h-11 text-base font-medium border transition-colors${n === p.userVote ? " active" : ""}`;
              return `<button type="button" data-vote-value="${n}" class="${numCls}">${n}</button>`;
            })
            .join("")}
        </div>
      </div>`
    : "";

  const cursorCls = p.loggedIn ? " cursor-pointer" : "";

  return `<article class="knk-game-card min-w-75 max-w-75 group border border-(--knk-line) bg-(--knk-surface) hover:border-(--knk-line-strong) transition-colors${cursorCls}" data-status-ids="${p.statusIds}" data-name="${p.name}" data-game-id="${p.gameId}" data-avg="${p.communityAvg != null ? String(p.communityAvg) : ""}" data-avg-count="${String(p.voteCount)}" data-vote="${hasVote ? String(p.userVote) : ""}">
    <div class="relative aspect-2/3 bg-(--knk-surface-2) knk-grid-bg overflow-hidden">
      ${cover}
      ${statusBadge}
      <div class="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2">
        ${personalBadge}
        ${avgBadge}
      </div>
      ${voteUI}
    </div>
    <div class="p-4 max-h-fit overflow-hidden text-ellipsis">
      <h3 class="font-(--font-display) text-base tracking-tight group-hover:text-(--knk-primary) transition-colors cursor-default" title="${p.name}">${p.name}</h3>
    </div>
  </article>`;
}

export interface GamesGridController {
  setQuery: (term: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  recalc: () => void;
  destroy: () => void;
}

interface InitialData {
  games: GameListRow[];
  total: number;
  loggedIn: boolean;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 24;

/**
 * Wire up the /games grid: global name search, pagination, card rendering,
 * and the results counter. The status filter calls `recalc()` after toggling
 * so the counter reflects both search + status visibility.
 */
export function initGamesGrid(): GamesGridController {
  const grid = document.getElementById("games-grid");
  const input: HTMLInputElement | null = document.getElementById(
    "games-search",
  ) as HTMLInputElement;
  const clearBtn = document.getElementById("games-search-clear");
  const visibleCount = document.getElementById("visible-count");
  const totalCount = document.getElementById("total-count");
  const resultLabel = document.getElementById("result-label");
  const noResults = document.getElementById("filter-no-results");

  if (!grid || !input || !(input instanceof HTMLInputElement)) {
    return {
      setQuery: () => {},
      clearSearch: () => {},
      loadMore: () => {},
      recalc: () => {},
      destroy: () => {},
    };
  }

  // Hydrate from the SSR-emitted initial data (avoids a redundant page-0 fetch).
  const initialRaw = document.getElementById("games-initial")?.textContent;
  let initial: InitialData = { games: [], total: 0, loggedIn: false };
  try {
    if (initialRaw) initial = JSON.parse(initialRaw) as InitialData;
  } catch {
    initial = { games: [], total: 0, loggedIn: false };
  }

  const { loggedIn } = initial;

  let query = "";
  let offset = 0;
  let totalLibrary = initial.total;
  let matchingCount = initial.total;
  let loading = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;

  /** Render a list of rows into card elements and append/replace in the grid. */
  function renderRows(games: GameListRow[], mode: "replace" | "append"): void {
    const html = games
      .map((game) => {
        const communityAvg =
          game.vote_count != null &&
          game.vote_count > 0 &&
          game.avg_vote != null
            ? game.avg_vote
            : null;
        const voteCount =
          game.vote_count != null && game.vote_count > 0 ? game.vote_count : 0;
        return renderCard({
          name: game.name,
          coverUrl: game.cover_url,
          status: statusName(game.status),
          statusIds: statusIdString(game.status),
          gameId: game.id,
          communityAvg,
          voteCount,
          userVote: null,
          loggedIn,
        });
      })
      .join("");

    if (mode === "replace") {
      grid!.innerHTML = html;
    } else {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      while (tmp.firstChild) grid!.appendChild(tmp.firstChild);
    }
  }

  /** Refresh the counter + no-results message from current visibility. */
  function updateCounter(visible: number): void {
    if (visibleCount) visibleCount.textContent = String(visible);
    if (totalCount) totalCount.textContent = String(totalLibrary);
    if (noResults) noResults.hidden = visible > 0;
    // "Filtering" = a search query is active OR the status filter is hiding
    // cards (visible < cards in grid). It is NOT "more pages exist" —
    // pagination alone shouldn't trigger the filtered wording. Toggle the
    // label between "Mostrando" (unfiltered) and "Filtrados" (filtered) so
    // the user sees the filtered count vs the total library.
    const inGrid = countInGrid();
    const filtering = query !== "" || visible < inGrid;
    if (resultLabel)
      resultLabel.textContent = filtering ? "Filtrados " : "Mostrando ";
  }

  /** Count cards currently visible (not hidden by the status filter). */
  function countVisible(): number {
    const cards = grid?.querySelectorAll<HTMLElement>(".knk-game-card") ?? [];
    let visible = 0;
    cards.forEach((card) => {
      if (!card.hidden) visible += 1;
    });
    return visible;
  }

  /** Count all cards rendered in the grid (includes status-hidden ones). */
  function countInGrid(): number {
    return grid?.querySelectorAll(".knk-game-card")?.length ?? 0;
  }

  /** Fetch a page from the API and render it. */
  async function fetchPage(opts: {
    offset: number;
    limit: number;
    q: string;
    mode: "replace" | "append";
  }): Promise<void> {
    if (loading) return;
    loading = true;
    abortController?.abort();
    abortController = new AbortController();

    const params = new URLSearchParams({
      q: opts.q,
      offset: String(opts.offset),
      limit: String(opts.limit),
    });

    try {
      const res = await fetch(`/api/games/search?${params.toString()}`, {
        signal: abortController.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        games: GameListRow[];
        count: number;
      };
      matchingCount = json.count;
      renderRows(json.games, opts.mode);
      // The status filter re-applies its visibility rules to the new cards.
      document.dispatchEvent(new CustomEvent("games:grid-updated"));
    } catch {
      // aborted or network error — ignore
    } finally {
      loading = false;
    }
  }

  /** Run a search: reset offset, replace the grid, refresh counter. */
  function runSearch(q: string): void {
    query = q;
    offset = 0;
    void fetchPage({ offset: 0, limit: PAGE_SIZE, q, mode: "replace" });
  }

  /** Public: set the search term (debounced). */
  function setQuery(term: string): void {
    if (term === query) return;
    input!.value = term;
    syncClear();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(term), DEBOUNCE_MS);
  }

  /** Public: clear the search back to the full library. */
  function clearSearch(): void {
    if (searchTimer) clearTimeout(searchTimer);
    input!.value = "";
    syncClear();
    runSearch("");
  }

  /** Public: fetch the next page and append (future infinite-scroll hook). */
  function loadMore(): void {
    if (loading) return;
    const next = offset + PAGE_SIZE;
    if (next >= matchingCount) return; // nothing left
    offset = next;
    void fetchPage({
      offset: next,
      limit: PAGE_SIZE,
      q: query,
      mode: "append",
    });
  }

  /** Public: status filter toggled — re-count visible + refresh counter. */
  function recalc(): void {
    updateCounter(countVisible());
  }

  function syncClear(): void {
    if (clearBtn) clearBtn.hidden = input!.value === "";
  }

  const onInput = (): void => {
    const term = input.value;
    syncClear();
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (term !== query) runSearch(term);
    }, DEBOUNCE_MS);
  };

  const onClearClick = (): void => {
    clearSearch();
    input.focus();
  };

  const onEscape = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (input.value !== "") {
      clearSearch();
    } else {
      input.blur();
    }
  };

  input.addEventListener("input", onInput);
  input.addEventListener("change", onInput);
  input.addEventListener("keydown", onEscape);
  clearBtn?.addEventListener("click", onClearClick);

  // Hydrate the initial SSR-rendered cards without a fetch.
  renderRows(initial.games, "replace");
  offset = initial.games.length;
  matchingCount = initial.total;
  updateCounter(countVisible());

  return {
    setQuery,
    clearSearch,
    loadMore,
    recalc,
    destroy() {
      if (searchTimer) clearTimeout(searchTimer);
      abortController?.abort();
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", onInput);
      input.removeEventListener("keydown", onEscape);
      clearBtn?.removeEventListener("click", onClearClick);
    },
  };
}
