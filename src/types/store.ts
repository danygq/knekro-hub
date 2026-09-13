interface GamesStore {
  layout: GamesLayoutStore;
}

interface GamesLayoutStore {
  isDesktop: boolean;
  gamesFilterMenuOpen: boolean;
}

interface SearchStore {
  query: string;
  offset: number;
  limit: number;
  filters: FiltersStore;
  resetOffset(): void;
}

interface FiltersStore {
  status: StatusFilterStore;
}

interface StatusFilterStore {
  included: Set<string>;
  excluded: Set<string>;
  toggle(id: string | number, mode: "plus" | "minus" | string): void;
  reset(): void;
  readonly count: number;
  isActive(id: string | number, mode: "plus" | "minus" | string): boolean;
}
