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

import type { GameListRow } from "../../types";

export interface GamesGridController {
  setQuery: (term: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  recalc: () => void;
  destroy: () => void;
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
