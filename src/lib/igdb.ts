import { getTwitchAppAccessToken } from "./twitch/helix";

interface IgdbGameItem {
  id: number;
  name: string;
  cover?: {
    id: number;
    image_id: string;
  };
}

function getTwitchClientId(): string | null {
  return (
    (typeof import.meta !== "undefined" && import.meta?.env?.TWITCH_CLIENT_ID) ||
    process.env.TWITCH_CLIENT_ID ||
    null
  );
}

/**
 * Searches IGDB for a game by name using Apicalypse query syntax and returns its cover URL.
 * URL pattern: https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.webp
 *
 * Uses Twitch App Access Token (Client Credentials) for authentication:
 * POST https://api.igdb.com/v4/games
 * Headers: Client-ID, Authorization: Bearer <token>
 * Body: search "{name}"; fields name, cover.image_id; limit 1;
 *
 * Never throws — returns null on missing credentials, no results, or unexpected errors.
 */
export async function fetchIgdbCover(name: string): Promise<string | null> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return null;
  }

  const clientId = getTwitchClientId();
  if (!clientId) {
    console.warn("[IGDB] Missing TWITCH_CLIENT_ID — skipping IGDB lookup.");
    return null;
  }

  let token: string;
  try {
    token = await getTwitchAppAccessToken(clientId);
  } catch (err) {
    console.error(
      "[IGDB] Failed to acquire Twitch App Access Token for IGDB:",
      err,
    );
    return null;
  }

  // Escape backslashes and double quotes in game name for Apicalypse search query
  const sanitizedName = trimmedName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `search "${sanitizedName}"; fields name, cover.image_id; limit 1;`;

  try {
    console.log(`[IGDB] Querying IGDB for "${trimmedName}"...`);
    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "text/plain",
      },
      body: query,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(
        `[IGDB] Query failed for "${trimmedName}": ${res.status} ${res.statusText} - ${errorText}`,
      );
      return null;
    }

    const items = (await res.json()) as IgdbGameItem[];
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[IGDB] No search results found for "${trimmedName}".`);
      return null;
    }

    const match = items[0];
    if (!match.cover?.image_id) {
      console.log(
        `[IGDB] Game "${match.name}" (id: ${match.id}) found, but has no cover image_id.`,
      );
      return null;
    }

    const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${match.cover.image_id}.webp`;
    console.log(
      `[IGDB] Cover found for "${trimmedName}" (game: "${match.name}", image_id: ${match.cover.image_id}): ${coverUrl}`,
    );
    return coverUrl;
  } catch (err) {
    console.error(`[IGDB] Error querying IGDB for "${trimmedName}":`, err);
    return null;
  }
}
