import type { GameSortOption } from "./games";

export type { GameSortOption };

export interface GamesStore {
  layout: GamesLayoutStore;
}

export interface GamesLayoutStore {
  isDesktop: boolean;
  gamesFilterMenuOpen: boolean;
}

export interface SearchStore {
  query: string;
  offset: number;
  limit: number;
  sort: GameSortOption;
  filters: FiltersStore;
  setSort(option: GameSortOption): void;
  resetOffset(): void;
}

export interface FiltersStore {
  status: StatusFilterStore;
}

export interface StatusFilterStore {
  included: Set<string>;
  excluded: Set<string>;
  toggle(id: string | number, mode: "plus" | "minus" | string): void;
  reset(): void;
  readonly count: number;
  isActive(id: string | number, mode: "plus" | "minus" | string): boolean;
}

export interface GamesFilterPreferences {
  status?: {
    included?: string[];
    excluded?: string[];
  };
}

export interface GamesPreferences {
  sort?: GameSortOption;
  filters?: GamesFilterPreferences;
}
