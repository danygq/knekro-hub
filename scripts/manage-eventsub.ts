/**
 * CLI utility to manage Twitch EventSub webhook subscriptions for Knekro Hub.
 *
 * Usage:
 *   node scripts/manage-eventsub.ts list
 *   node scripts/manage-eventsub.ts subscribe [callback_url]
 *   node scripts/manage-eventsub.ts delete <subscription_id>
 *   node scripts/manage-eventsub.ts delete-all
 */

// Load .env.local if present
try {
  process.loadEnvFile(".env.local");
} catch {
  // If already loaded or file missing, fallback to process.env
}

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const EVENTSUB_SECRET = process.env.TWITCH_EVENTSUB_SECRET;
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID || "152633332";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env.local");
  process.exit(1);
}

async function getAppAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Twitch App Access Token: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function listSubscriptions(token: string) {
  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    headers: {
      "Client-Id": CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list subscriptions: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    total: number;
    total_cost: number;
    max_total_cost: number;
    data: Array<{
      id: string;
      status: string;
      type: string;
      version: string;
      condition: Record<string, string>;
      created_at: string;
      transport: {
        method: string;
        callback: string;
      };
    }>;
  };

  console.log(`\n--- Active EventSub Subscriptions (${data.data.length}) [Cost: ${data.total_cost}/${data.max_total_cost}] ---`);
  if (data.data.length === 0) {
    console.log("No active subscriptions found.");
  } else {
    for (const sub of data.data) {
      console.log(`ID:        ${sub.id}`);
      console.log(`Type:      ${sub.type} (v${sub.version})`);
      console.log(`Status:    ${sub.status}`);
      console.log(`Condition: ${JSON.stringify(sub.condition)}`);
      console.log(`Callback:  ${sub.transport.callback}`);
      console.log(`Created:   ${sub.created_at}`);
      console.log("--------------------------------------------------");
    }
  }
}

async function createSubscription(
  token: string,
  type: string,
  version: string,
  condition: Record<string, string>,
  callbackUrl: string,
) {
  if (!EVENTSUB_SECRET) {
    throw new Error("TWITCH_EVENTSUB_SECRET is required to subscribe to webhooks");
  }

  const payload = {
    type,
    version,
    condition,
    transport: {
      method: "webhook",
      callback: callbackUrl,
      secret: EVENTSUB_SECRET,
    },
  };

  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-Id": CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`Failed to subscribe to ${type}: ${res.status} ${responseText}`);
    return;
  }

  const data = JSON.parse(responseText);
  console.log(`Successfully subscribed to ${type}: Subscription ID ${data.data[0]?.id}, Status: ${data.data[0]?.status}`);
}

async function deleteSubscription(token: string, id: string) {
  const res = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`, {
    method: "DELETE",
    headers: {
      "Client-Id": CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 204) {
    console.log(`Deleted subscription ${id}`);
  } else {
    const text = await res.text();
    console.error(`Failed to delete subscription ${id}: ${res.status} ${text}`);
  }
}

async function main() {
  const command = process.argv[2] || "list";

  try {
    const token = await getAppAccessToken();

    if (command === "list") {
      await listSubscriptions(token);
      return;
    }

    if (command === "subscribe") {
      const callbackUrl =
        process.argv[3] ||
        process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") + "/api/webhooks/twitch" ||
        "https://knekro.vercel.app/api/webhooks/twitch";

      console.log(`Registering subscriptions for broadcaster ${BROADCASTER_ID}`);
      console.log(`Webhook callback URL: ${callbackUrl}`);

      await createSubscription(
        token,
        "stream.online",
        "1",
        { broadcaster_user_id: BROADCASTER_ID },
        callbackUrl,
      );

      await createSubscription(
        token,
        "stream.offline",
        "1",
        { broadcaster_user_id: BROADCASTER_ID },
        callbackUrl,
      );

      return;
    }

    if (command === "delete") {
      const id = process.argv[3];
      if (!id) {
        console.error("Usage: node scripts/manage-eventsub.ts delete <subscription_id>");
        process.exit(1);
      }
      await deleteSubscription(token, id);
      return;
    }

    if (command === "delete-all") {
      const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        headers: {
          "Client-Id": CLIENT_ID!,
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as { data: Array<{ id: string }> };
      for (const sub of data.data) {
        await deleteSubscription(token, sub.id);
      }
      console.log("All subscriptions deleted.");
      return;
    }

    console.log(`Unknown command: ${command}`);
    console.log("Available commands: list, subscribe [callback_url], delete <id>, delete-all");
  } catch (error) {
    console.error("Error executing EventSub manager:", error);
    process.exit(1);
  }
}

main();
