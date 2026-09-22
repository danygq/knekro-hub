import type { GameSortOption, GamesPreferences } from "@/types";

export const GAMES_PREFERENCES_KEY = "knk_games_preferences";

export const VALID_GAME_SORT_OPTIONS: readonly GameSortOption[] = [
  "name_asc",
  "name_desc",
  "last_played_desc",
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
 * Resolves a safe sort option, falling back to "name_asc" if invalid or if
 * a personal vote sort is requested while unauthenticated.
 */
export function resolveGameSortOption(
  sort: unknown,
  loggedIn: boolean,
): GameSortOption {
  if (!isValidGameSortOption(sort)) {
    return "name_asc";
  }
  if ((sort === "user_vote_desc" || sort === "user_vote_asc") && !loggedIn) {
    return "name_asc";
  }
  return sort;
}

/**
 * Safely parses a raw string (JSON or URI-encoded JSON) into a GamesPreferences object.
 * Safe for use in both SSR (cookies) and client-side (localStorage/cookies).
 */
export function parseGamesPreferences(
  raw: string | undefined | null,
): GamesPreferences {
  if (!raw) return {};

  try {
    const decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as GamesPreferences;
  } catch {
    return {};
  }
}

/**
 * Safely loads user preferences for the games library from localStorage or cookies.
 * Returns an empty object on failure or if nothing is stored.
 */
export function loadGamesPreferences(): GamesPreferences {
  if (typeof window === "undefined") {
    return {};
  }

  // 1. Try localStorage
  try {
    const localRaw = window.localStorage?.getItem(GAMES_PREFERENCES_KEY);
    if (localRaw) {
      const parsed = parseGamesPreferences(localRaw);
      if (Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to load games preferences from localStorage:", error);
  }

  // 2. Fallback to document.cookie
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${GAMES_PREFERENCES_KEY}=`));
    if (match) {
      const cookieVal = match.split("=")[1];
      return parseGamesPreferences(cookieVal);
    }
  } catch (error) {
    console.warn("Failed to load games preferences from cookie:", error);
  }

  return {};
}

/**
 * Safely updates games preferences with shallow-merged partial fields.
 * Persists to both localStorage and a 1-year cookie so SSR can read preferences on initial request.
 */
export function saveGamesPreferences(updates: Partial<GamesPreferences>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = loadGamesPreferences();
    const next: GamesPreferences = {
      ...current,
      ...updates,
    };
    const serialized = JSON.stringify(next);

    // Save to localStorage
    try {
      window.localStorage?.setItem(GAMES_PREFERENCES_KEY, serialized);
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }

    // Save to cookie (1 year duration, SameSite=Lax, accessible to SSR GET /games)
    const encoded = encodeURIComponent(serialized);
    document.cookie = `${GAMES_PREFERENCES_KEY}=${encoded}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (error) {
    console.warn("Failed to save games preferences:", error);
  }
}
