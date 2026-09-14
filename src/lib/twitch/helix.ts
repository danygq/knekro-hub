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
