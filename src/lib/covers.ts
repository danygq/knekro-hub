import { fetchSgdbCover } from "./steamgriddb";
import { fetchIgdbCover } from "./igdb";

export interface GameCoverResult {
  url: string;
  source: "steamgriddb" | "igdb";
}

/**
 * Resolves a game cover URL by name using a multi-provider fallback strategy:
 * 1. Primary: SteamGridDB (600x900 grid image)
 * 2. Fallback: IGDB (t_cover_big webp image via Twitch Client Credentials)
 *
 * If neither provider finds a cover, returns null.
 * Never throws — all provider errors are caught, logged, and handled safely.
 */
export async function resolveGameCover(
  name: string,
): Promise<GameCoverResult | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Primary provider: SteamGridDB
  try {
    const sgdbUrl = await fetchSgdbCover(trimmed);
    if (sgdbUrl) {
      return { url: sgdbUrl, source: "steamgriddb" };
    }
  } catch (err) {
    console.error(
      `[Cover Resolver] Unexpected error checking SteamGridDB for "${trimmed}":`,
      err,
    );
  }

  // 2. Fallback provider: IGDB
  console.log(
    `[Cover Resolver] No SteamGridDB cover for "${trimmed}". Trying IGDB fallback...`,
  );
  try {
    const igdbUrl = await fetchIgdbCover(trimmed);
    if (igdbUrl) {
      console.log(
        `[Cover Resolver] IGDB fallback resolved cover for "${trimmed}": ${igdbUrl}`,
      );
      return { url: igdbUrl, source: "igdb" };
    }
  } catch (err) {
    console.error(
      `[Cover Resolver] Unexpected error checking IGDB for "${trimmed}":`,
      err,
    );
  }

  console.log(
    `[Cover Resolver] No cover found on SteamGridDB or IGDB for "${trimmed}".`,
  );
  return null;
}
