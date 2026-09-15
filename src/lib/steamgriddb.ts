/**
 * SteamGridDB API helpers.
 *
 * Server-only. Reads STEAMGRIDDB_API_KEY from the environment (no PUBLIC_ prefix).
 * All functions are non-throwing: errors are logged and null is returned so
 * callers (e.g. the Twitch webhook handler) are never disrupted.
 */

interface SgdbSearchResult {
  id: number;
  name: string;
}

interface SgdbSearchResponse {
  success: boolean;
  data: SgdbSearchResult[];
}

interface SgdbGridItem {
  id: number;
  url: string;
}

interface SgdbGridsResponse {
  success: boolean;
  data: SgdbGridItem[];
}

function getSgdbApiKey(): string | null {
  return (
    (typeof import.meta !== "undefined" && import.meta?.env?.STEAMGRIDDB_API_KEY) ||
    process.env.STEAMGRIDDB_API_KEY ||
    null
  );
}

/**
 * Searches SteamGridDB for the best 600×900 grid cover image matching `name`.
 *
 * Two-step lookup:
 *   1. GET /api/v2/search/autocomplete/{name}  → takes data[0].id as the SGDB game ID
 *   2. GET /api/v2/grids/game/{sgdbId}?dimensions=600x900 → takes data[0].url
 *
 * Returns the image URL string, or null when:
 *   - STEAMGRIDDB_API_KEY is not configured
 *   - Either API step returns no results
 *   - A network/parse error occurs
 *
 * Never throws.
 */
export async function fetchSgdbCover(name: string): Promise<string | null> {
  const apiKey = getSgdbApiKey();

  if (!apiKey) {
    console.warn(
      "[SteamGridDB] STEAMGRIDDB_API_KEY is not set — skipping cover fetch.",
    );
    return null;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    console.warn("[SteamGridDB] fetchSgdbCover called with empty name — skipping.");
    return null;
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  // Step 1: Autocomplete search → resolve SGDB game ID
  let sgdbId: number;
  try {
    const searchUrl = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(trimmedName)}`;
    console.log(`[SteamGridDB] Searching for "${trimmedName}" → ${searchUrl}`);

    const searchRes = await fetch(searchUrl, { headers });

    if (!searchRes.ok) {
      console.warn(
        `[SteamGridDB] Search request failed for "${trimmedName}": ${searchRes.status} ${searchRes.statusText}`,
      );
      return null;
    }

    const searchJson = (await searchRes.json()) as SgdbSearchResponse;

    if (!searchJson.success || !searchJson.data?.length) {
      console.log(`[SteamGridDB] No search results for "${trimmedName}".`);
      return null;
    }

    sgdbId = searchJson.data[0].id;
    console.log(
      `[SteamGridDB] Resolved "${trimmedName}" → SGDB id=${sgdbId} ("${searchJson.data[0].name}")`,
    );
  } catch (err) {
    console.error(
      `[SteamGridDB] Error during autocomplete search for "${trimmedName}":`,
      err,
    );
    return null;
  }

  // Step 2: Fetch 600×900 grid covers for the resolved SGDB game ID
  try {
    const gridsUrl = `https://www.steamgriddb.com/api/v2/grids/game/${sgdbId}?dimensions=600x900`;
    console.log(`[SteamGridDB] Fetching grids for SGDB id=${sgdbId} → ${gridsUrl}`);

    const gridsRes = await fetch(gridsUrl, { headers });

    if (!gridsRes.ok) {
      console.warn(
        `[SteamGridDB] Grids request failed for SGDB id=${sgdbId}: ${gridsRes.status} ${gridsRes.statusText}`,
      );
      return null;
    }

    const gridsJson = (await gridsRes.json()) as SgdbGridsResponse;

    if (!gridsJson.success || !gridsJson.data?.length) {
      console.log(
        `[SteamGridDB] No 600×900 grid results for "${trimmedName}" (SGDB id=${sgdbId}).`,
      );
      return null;
    }

    const coverUrl = gridsJson.data[0].url;
    console.log(
      `[SteamGridDB] Cover found for "${trimmedName}" (SGDB id=${sgdbId}): ${coverUrl}`,
    );
    return coverUrl;
  } catch (err) {
    console.error(
      `[SteamGridDB] Error fetching grids for "${trimmedName}" (SGDB id=${sgdbId}):`,
      err,
    );
    return null;
  }
}
