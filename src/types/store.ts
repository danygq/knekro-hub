interface GamesStore {
  layout: GamesLayoutStore;
}

interface GamesLayoutStore {
  isDesktop: boolean;
  gamesFilterMenuOpen: boolean;
}

interface SearchStore {
  query: string;
}

interface FilterStore {
  included: Set<string>;
  excluded: Set<string>;
  toggle(id: string | number, mode: "plus" | "minus" | string): void;
  reset(): void;
  matches(ids?: (string | number)[]): boolean;
  readonly count: number;
  isActive(id: string | number, mode: "plus" | "minus" | string): boolean;
}
