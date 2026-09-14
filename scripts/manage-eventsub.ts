/**
 * CLI utility to manage Twitch EventSub webhook subscriptions for Knekro Hub.
 *
 * Usage:
 *   node scripts/manage-eventsub.ts list [--type <type>]
 *   node scripts/manage-eventsub.ts subscribe [--url <callback_url>] [--type <type>] [--broadcaster-id <id>]
 *   node scripts/manage-eventsub.ts delete --id <subscription_id>
 *   node scripts/manage-eventsub.ts delete-all
 *   node scripts/manage-eventsub.ts --help
 */

import { parseArgs } from "node:util";
import {
  DEFAULT_TWITCH_BROADCASTER_ID,
  TWITCH_EVENTSUB_SUBSCRIPTIONS,
} from "../src/lib/twitch/constants.ts";

// Load .env.local if present
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fallback if .env.local is already loaded or absent
}

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const EVENTSUB_SECRET = process.env.TWITCH_EVENTSUB_SECRET;

function printHelp() {
  console.log(`
Twitch EventSub Management CLI

Usage:
  node scripts/manage-eventsub.ts <command> [options]

Commands:
  list                 List all active EventSub subscriptions
  subscribe            Create subscriptions for Twitch webhook events
  delete               Delete a subscription by its ID
  delete-all           Delete all existing EventSub subscriptions
  help                 Display this help message

Options:
  -u, --url <url>             Webhook callback URL (default: PUBLIC_SITE_URL/api/webhooks/twitch)
  -t, --type <type>           Filter by or subscribe to specific event type (e.g. stream.online, channel.update)
  -i, --id <id>               Subscription ID for deletion
  -b, --broadcaster-id <id>   Broadcaster user ID (default: TWITCH_BROADCASTER_ID or "${DEFAULT_TWITCH_BROADCASTER_ID}")
  -h, --help                  Show help

Examples:
  node scripts/manage-eventsub.ts list
  node scripts/manage-eventsub.ts list --type stream.online
  node scripts/manage-eventsub.ts subscribe --url https://your-domain.vercel.app/api/webhooks/twitch
  node scripts/manage-eventsub.ts subscribe -u https://example.com/api/webhooks/twitch -t channel.update
  node scripts/manage-eventsub.ts delete --id 82fb55f2-b883-4a16-bb70-13f50ef75f28
  node scripts/manage-eventsub.ts delete-all
`);
}

async function getAppAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in environment (.env.local)",
    );
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function listSubscriptions(token: string, filterType?: string) {
  const url = new URL("https://api.twitch.tv/helix/eventsub/subscriptions");
  if (filterType) {
    url.searchParams.set("type", filterType);
  }

  const res = await fetch(url.toString(), {
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

  console.log(
    `\n--- Active EventSub Subscriptions (${data.data.length}) [Cost: ${data.total_cost}/${data.max_total_cost}] ---`,
  );
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
    throw new Error(
      "TWITCH_EVENTSUB_SECRET is required to subscribe to webhooks",
    );
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

  const res = await fetch(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
      method: "POST",
      headers: {
        "Client-Id": CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const responseText = await res.text();
  if (!res.ok) {
    console.error(
      `Failed to subscribe to ${type}: ${res.status} ${responseText}`,
    );
    return;
  }

  const data = JSON.parse(responseText);
  console.log(
    `Successfully subscribed to ${type}: Subscription ID ${data.data[0]?.id}, Status: ${data.data[0]?.status}`,
  );
}

async function deleteSubscription(token: string, id: string) {
  const res = await fetch(
    `https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`,
    {
      method: "DELETE",
      headers: {
        "Client-Id": CLIENT_ID!,
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (res.status === 204) {
    console.log(`Deleted subscription ${id}`);
  } else {
    const text = await res.text();
    console.error(`Failed to delete subscription ${id}: ${res.status} ${text}`);
  }
}

async function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        url: {
          type: "string",
          short: "u",
        },
        type: {
          type: "string",
          short: "t",
        },
        id: {
          type: "string",
          short: "i",
        },
        "broadcaster-id": {
          type: "string",
          short: "b",
        },
        help: {
          type: "boolean",
          short: "h",
        },
      },
    });
  } catch (err: any) {
    console.error(`Argument error: ${err.message}`);
    printHelp();
    process.exit(1);
  }

  const { values, positionals } = parsedArgs;

  if (values.help || positionals[0] === "help") {
    printHelp();
    return;
  }

  const command = positionals[0] || "list";
  const broadcasterId =
    values["broadcaster-id"] ||
    process.env.TWITCH_BROADCASTER_ID ||
    DEFAULT_TWITCH_BROADCASTER_ID;

  try {
    const token = await getAppAccessToken();

    if (command === "list") {
      // Allow --type flag or 2nd positional argument as fallback
      const filterType = values.type || positionals[1];
      await listSubscriptions(token, filterType);
      return;
    }

    if (command === "subscribe") {
      // Check for positional URL / type fallback if flags were not provided
      let callbackUrl = values.url;
      let specificType = values.type;

      if (!callbackUrl && positionals[1]) {
        if (
          positionals[1].startsWith("http://") ||
          positionals[1].startsWith("https://")
        ) {
          callbackUrl = positionals[1];
          if (positionals[2]) {
            specificType = positionals[2];
          }
        } else {
          specificType = positionals[1];
        }
      }

      const defaultPublicSiteUrl = process.env.PUBLIC_SITE_URL
        ? `${process.env.PUBLIC_SITE_URL.replace(/\/$/, "")}/api/webhooks/twitch`
        : "https://knekro.vercel.app/api/webhooks/twitch";

      const finalCallbackUrl = callbackUrl || defaultPublicSiteUrl;

      console.log(
        `Registering subscriptions for broadcaster ID: ${broadcasterId}`,
      );
      console.log(`Webhook callback URL: ${finalCallbackUrl}`);

      const subscriptionsToRegister = specificType
        ? TWITCH_EVENTSUB_SUBSCRIPTIONS.filter(
            (sub) => sub.type === specificType,
          )
        : TWITCH_EVENTSUB_SUBSCRIPTIONS;

      if (subscriptionsToRegister.length === 0) {
        console.error(
          `Unknown subscription type: '${specificType}'. Supported types: ${TWITCH_EVENTSUB_SUBSCRIPTIONS.map((s) => s.type).join(", ")}`,
        );
        process.exit(1);
      }

      for (const sub of subscriptionsToRegister) {
        await createSubscription(
          token,
          sub.type,
          sub.version,
          { broadcaster_user_id: broadcasterId },
          finalCallbackUrl,
        );
      }

      return;
    }

    if (command === "delete") {
      const subscriptionId = values.id || positionals[1];
      if (!subscriptionId) {
        console.error(
          "Error: Missing subscription ID. Pass --id <subscription_id> or provide it as a positional argument.",
        );
        printHelp();
        process.exit(1);
      }
      await deleteSubscription(token, subscriptionId);
      return;
    }

    if (command === "delete-all") {
      const res = await fetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          headers: {
            "Client-Id": CLIENT_ID!,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = (await res.json()) as { data: Array<{ id: string }> };
      for (const sub of data.data) {
        await deleteSubscription(token, sub.id);
      }
      console.log(`All ${data.data.length} subscriptions deleted.`);
      return;
    }

    console.error(`Unknown command: '${command}'`);
    printHelp();
    process.exit(1);
  } catch (error) {
    console.error("Error executing EventSub manager:", error);
    process.exit(1);
  }
}

main();
