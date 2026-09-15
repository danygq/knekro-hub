import { fetchIgdbCover } from "./igdb.ts";
import { fetchSgdbCover } from "./steamgriddb.ts";

export interface GameCoverResult {
  url: string;
  source: "igdb" | "steamgriddb";
}

/**
 * Resolves a game cover URL by name using a multi-provider fallback strategy:
 * 1. Primary: IGDB (t_cover_big webp image via Twitch Client Credentials)
 * 2. Fallback: SteamGridDB (600x900 grid image)
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

  // 1. Primary provider: IGDB
  try {
    const igdbUrl = await fetchIgdbCover(trimmed);
    if (igdbUrl) {
      return { url: igdbUrl, source: "igdb" };
    }
  } catch (err) {
    console.error(
      `[Cover Resolver] Unexpected error checking IGDB for "${trimmed}":`,
      err,
    );
  }

  // 2. Fallback provider: SteamGridDB
  console.log(
    `[Cover Resolver] No IGDB cover for "${trimmed}". Trying SteamGridDB fallback...`,
  );
  try {
    const sgdbUrl = await fetchSgdbCover(trimmed);
    if (sgdbUrl) {
      console.log(
        `[Cover Resolver] SteamGridDB fallback resolved cover for "${trimmed}": ${sgdbUrl}`,
      );
      return { url: sgdbUrl, source: "steamgriddb" };
    }
  } catch (err) {
    console.error(
      `[Cover Resolver] Unexpected error checking SteamGridDB fallback for "${trimmed}":`,
      err,
    );
  }

  console.log(
    `[Cover Resolver] No cover found on IGDB or SteamGridDB for "${trimmed}".`,
  );
  return null;
}
