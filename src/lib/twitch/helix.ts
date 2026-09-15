interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getTwitchAppAccessToken(
  clientId?: string,
  clientSecret?: string,
): Promise<string> {
  const resolvedClientId =
    clientId ||
    import.meta?.env?.TWITCH_CLIENT_ID ||
    process.env.TWITCH_CLIENT_ID;

  const resolvedClientSecret =
    clientSecret ||
    import.meta?.env?.TWITCH_CLIENT_SECRET ||
    process.env.TWITCH_CLIENT_SECRET;

  if (!resolvedClientId || !resolvedClientSecret) {
    throw new Error(
      "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables",
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    client_id: resolvedClientId,
    client_secret: resolvedClientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to get Twitch App Access Token: ${res.status} ${text}`,
    );
  }

  const data = (await res.json()) as TwitchTokenResponse;
  // Cache token with 60-second safety margin
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export interface HelixStreamItem {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids?: string[];
  tags?: string[];
  is_mature: boolean;
}

export interface HelixStreamsResponse {
  data: HelixStreamItem[];
}

export async function getHelixStream(
  broadcasterId: string,
  token?: string,
  clientId?: string,
): Promise<HelixStreamItem | null> {
  const resolvedClientId =
    clientId ||
    import.meta?.env?.TWITCH_CLIENT_ID ||
    process.env.TWITCH_CLIENT_ID;

  if (!resolvedClientId) {
    throw new Error("Missing TWITCH_CLIENT_ID environment variable");
  }

  const accessToken =
    token || (await getTwitchAppAccessToken(resolvedClientId));

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`,
    {
      headers: {
        "Client-Id": resolvedClientId,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Helix stream info: ${res.status} ${text}`);
  }

  const json = (await res.json()) as HelixStreamsResponse;
  return json.data?.[0] ?? null;
}

export interface HelixGameItem {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id: string;
}

export interface HelixGamesResponse {
  data: HelixGameItem[];
  pagination?: {
    cursor?: string;
  };
}

/**
 * Fetches game/category metadata from Twitch Helix by exact name(s).
 * Supports up to 100 names per request per Twitch API limit.
 *
 * @param names - Array of game names to look up
 * @param token - Optional pre-fetched Twitch App Access Token
 * @param clientId - Optional Twitch Client ID
 */
export async function getHelixGames(
  names: string[],
  token?: string,
  clientId?: string,
): Promise<HelixGameItem[]> {
  if (!names || names.length === 0) {
    return [];
  }

  const resolvedClientId =
    clientId ||
    import.meta?.env?.TWITCH_CLIENT_ID ||
    process.env.TWITCH_CLIENT_ID;

  if (!resolvedClientId) {
    throw new Error("Missing TWITCH_CLIENT_ID environment variable");
  }

  const accessToken =
    token || (await getTwitchAppAccessToken(resolvedClientId));

  // Twitch Helix /games accepts up to 100 name parameters per request
  const boundedNames = names.slice(0, 100);
  const url = new URL("https://api.twitch.tv/helix/games");
  for (const name of boundedNames) {
    const trimmed = name.trim();
    if (trimmed) {
      url.searchParams.append("name", trimmed);
    }
  }

  if (!url.searchParams.has("name")) {
    return [];
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Client-Id": resolvedClientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Helix games info: ${res.status} ${text}`);
  }

  const json = (await res.json()) as HelixGamesResponse;
  return json.data ?? [];
}

/**
 * Fetches a single game/category from Twitch Helix by exact name.
 *
 * @param name - The game name to look up
 * @param token - Optional pre-fetched Twitch App Access Token
 * @param clientId - Optional Twitch Client ID
 */
export async function getHelixGameByName(
  name: string,
  token?: string,
  clientId?: string,
): Promise<HelixGameItem | null> {
  const games = await getHelixGames([name], token, clientId);
  return games[0] ?? null;
}
