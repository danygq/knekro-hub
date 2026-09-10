// Browser controller for the games library filter panel (status include/exclude).
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).
//
// Name search now lives in games-grid.ts (a global DB query). This controller
// handles status filtering only: it toggles card visibility and asks the grid
// to re-count / refresh the counter via the `onFilterChange` callback. When
// the grid renders a new page (search / lazy load), it dispatches
// `games:grid-updated`; the filter listens and re-applies its rules so status
// filtering composes with search + pagination.

/** Parse the space-separated `data-status-ids` attribute into a number list. */
export function parseStatusIds(raw: string): number[] {
  return raw
    .split(" ")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

/**
 * Core include/exclude rule shared by any filter UI.
 * A card shows when at least one of its status ids is included (if any are
 * required) AND none of its status ids is excluded.
 */
export function matchesFilter(
  statusIds: number[],
  included: Set<number>,
  excluded: Set<number>,
): boolean {
  if (included.size > 0 && !statusIds.some((id) => included.has(id)))
    return false;
  return !(excluded.size > 0 && statusIds.some((id) => excluded.has(id)));
}

/** Handle returned by initGamesFilter(). */
export interface GamesFilterController {
  destroy: () => void;
}

/**
 * Wire up the /games filter drawer: toggle/open/close + include/exclude status
 * buttons. Elements are resolved by id; the call is a no-op when the panel is
 * missing. After toggling, visibility is applied to the current cards and the
 * grid's counter is refreshed via `onFilterChange`.
 */
export function initGamesFilter(
  onFilterChange: () => void,
): GamesFilterController {
  const panel = document.getElementById("filter-panel");
  const backdrop = document.getElementById("filter-backdrop");
  const wrapper = document.getElementById("games-layout");
  const toggle = document.getElementById("toggle-filters");
  const closeBtn = document.getElementById("close-filters");
  const resetBtn = document.getElementById("reset-filters");
  const badge = document.getElementById("filter-count");

  if (!panel || !wrapper) {
    return { destroy: () => {} };
  }

  const isDesktop = () =>
    window.matchMedia
      ? window.matchMedia("(min-width: 1024px)").matches
      : window.innerWidth >= 1024;

  const included = new Set<number>();
  const excluded = new Set<number>();
  const state = { open: isDesktop() };

  function syncPanel() {
    const desktop = isDesktop();
    panel?.classList.toggle("open", state.open && !desktop);
    panel?.classList.toggle("closed", !state.open && desktop);
    backdrop?.classList.toggle("open", state.open && !desktop);
    wrapper?.classList.toggle("filters-off", !state.open);
    toggle?.setAttribute("aria-expanded", state.open ? "true" : "false");
  }

  /** Apply include/exclude visibility to all current cards + refresh counter. */
  function applyFilter() {
    if (resetBtn) {
      const active = included.size === 0 && excluded.size === 0;
      resetBtn.classList.toggle("active", active);
      resetBtn.setAttribute("aria-pressed", active ? "true" : "false");
    }

    document.querySelectorAll("[data-status-mode]").forEach((btn) => {
      const id = Number((btn as HTMLElement).dataset.statusId);
      const plus = (btn as HTMLElement).dataset.statusMode === "plus";
      const active = plus ? included.has(id) : excluded.has(id);
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const cards = document.querySelectorAll<HTMLElement>(".knk-game-card");
    cards.forEach((card) => {
      const ids = parseStatusIds(card.dataset.statusIds || "");
      card.hidden = !matchesFilter(ids, included, excluded);
    });

    if (badge) {
      const count = included.size + excluded.size;
      badge.hidden = count === 0;
      badge.textContent = String(count);
    }

    onFilterChange();
  }

  document.querySelectorAll("[data-status-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number((btn as HTMLElement).dataset.statusId);
      const plus = (btn as HTMLElement).dataset.statusMode === "plus";
      if (plus) {
        if (included.has(id)) {
          included.delete(id);
        } else {
          included.add(id);
          excluded.delete(id);
        }
      } else {
        if (excluded.has(id)) {
          excluded.delete(id);
        } else {
          excluded.add(id);
          included.delete(id);
        }
      }
      applyFilter();
    });
  });

  toggle?.addEventListener("click", () => {
    state.open = !state.open;
    syncPanel();
  });
  closeBtn?.addEventListener("click", () => {
    state.open = false;
    syncPanel();
  });
  resetBtn?.addEventListener("click", () => {
    included.clear();
    excluded.clear();
    applyFilter();
  });
  backdrop?.addEventListener("click", () => {
    state.open = false;
    syncPanel();
  });
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && state.open && !isDesktop()) {
      state.open = false;
      syncPanel();
    }
  };
  document.addEventListener("keydown", onEscape);

  let resizeTimer: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncPanel, 100);
  };
  window.addEventListener("resize", onResize);

  // When the grid renders a new page (search / lazy load), re-apply status rules.
  const onGridUpdated = () => {
    applyFilter();
  };
  document.addEventListener("games:grid-updated", onGridUpdated);

  syncPanel();

  return {
    destroy() {
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("games:grid-updated", onGridUpdated);
    },
  };
}
