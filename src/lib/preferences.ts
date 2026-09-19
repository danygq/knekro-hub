import type { GameSortOption, GamesPreferences } from "@/types";

export const GAMES_PREFERENCES_KEY = "knk_games_preferences";

export const VALID_GAME_SORT_OPTIONS: readonly GameSortOption[] = [
  "name_asc",
  "name_desc",
  "community_desc",
  "community_asc",
  "user_vote_desc",
  "user_vote_asc",
];

export function isValidGameSortOption(value: unknown): value is GameSortOption {
  return (
    typeof value === "string" &&
    VALID_GAME_SORT_OPTIONS.includes(value as GameSortOption)
  );
}

/**
 * Safely loads user preferences for the games library from localStorage.
 * Returns an empty object on failure or if nothing is stored.
 */
export function loadGamesPreferences(): GamesPreferences {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(GAMES_PREFERENCES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    return parsed as GamesPreferences;
  } catch (error) {
    console.warn("Failed to load games preferences from localStorage:", error);
    return {};
  }
}

/**
 * Safely updates games preferences in localStorage with shallow-merged partial fields.
 */
export function saveGamesPreferences(updates: Partial<GamesPreferences>): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const current = loadGamesPreferences();
    const next: GamesPreferences = {
      ...current,
      ...updates,
    };

    window.localStorage.setItem(GAMES_PREFERENCES_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Failed to save games preferences to localStorage:", error);
  }
}
