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
  status: FilterGroupStore;
  tag: FilterGroupStore;
  resetAll?: () => void;
  readonly totalCount?: number;
}

export interface FilterGroupStore {
  included: Set<string>;
  excluded: Set<string>;
  toggle(id: string | number, mode: "plus" | "minus" | string): void;
  reset(skipDispatch?: boolean): void;
  readonly count: number;
  isActive(id: string | number, mode: "plus" | "minus" | string): boolean;
}

export type StatusFilterStore = FilterGroupStore;

export interface GamesFilterPreferences {
  status?: {
    included?: string[];
    excluded?: string[];
  };
  tag?: {
    included?: string[];
    excluded?: string[];
  };
}

export interface GamesPreferences {
  sort?: GameSortOption;
  filters?: GamesFilterPreferences;
}
