// Browser controller for the games library filter panel.
// Import this ONLY from a page <script> — it references `window`/`document`
// and must never be imported into an .astro frontmatter (that runs in SSR).

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
export function matchesFilter(statusIds: number[], included: Set<number>, excluded: Set<number>): boolean {
  if (included.size > 0 && !statusIds.some((id) => included.has(id))) return false;
  return !(excluded.size > 0 && statusIds.some((id) => excluded.has(id)));
}

/**
 * Wire up the /games filter drawer: toggle/open/close, include/exclude status
 * buttons, visible count / no-results messaging, and the filter badge.
 * Elements are resolved by id; the call is a no-op when the panel is missing.
 */
export function initGamesFilter(): void {
  const panel = document.getElementById("filter-panel");
  const backdrop = document.getElementById("filter-backdrop");
  const wrapper = document.getElementById("games-layout");
  const toggle = document.getElementById("toggle-filters");
  const closeBtn = document.getElementById("close-filters");
  const resetBtn = document.getElementById("reset-filters");
  const visibleCount = document.getElementById("visible-count");
  const badge = document.getElementById("filter-count");
  const noResults = document.getElementById("filter-no-results");

  if (!panel || !wrapper) return;

  const isDesktop = () =>
    window.matchMedia ? window.matchMedia("(min-width: 1024px)").matches : window.innerWidth >= 1024;

  const cards: HTMLElement[] = Array.from(document.querySelectorAll(".knk-game-card"));
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

  function refresh() {
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

    let visible = 0;
    cards.forEach((card) => {
      const ids = parseStatusIds(card.dataset.statusIds || "");
      const show = matchesFilter(ids, included, excluded);
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (visibleCount) visibleCount.textContent = String(visible);
    if (noResults) noResults.hidden = visible > 0;
    if (badge) {
      const count = included.size + excluded.size;
      badge.hidden = count === 0;
      badge.textContent = String(count);
    }
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
      refresh();
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
    refresh();
  });
  backdrop?.addEventListener("click", () => {
    state.open = false;
    syncPanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open && !isDesktop()) {
      state.open = false;
      syncPanel();
    }
  });

  let resizeTimer: NodeJS.Timeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncPanel, 100);
  });

  refresh();
  syncPanel();
}
