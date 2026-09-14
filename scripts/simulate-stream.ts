/**
 * Helper to simulate Twitch EventSub webhook events locally or in production.
 *
 * Usage:
 *   node scripts/simulate-stream.ts start [--url <url>]
 *   node scripts/simulate-stream.ts stop [--url <url>]
 *   node scripts/simulate-stream.ts update [--name <category_name>] [--category-id <id>] [--title <title>] [--url <url>]
 *   node scripts/simulate-stream.ts db-start
 *   node scripts/simulate-stream.ts db-stop
 *   node scripts/simulate-stream.ts db-update [--name <category_name>] [--category-id <id>]
 *   node scripts/simulate-stream.ts --help
 */

import crypto from "node:crypto";
import { parseArgs } from "node:util";
import {
  DEFAULT_TWITCH_BROADCASTER_ID,
  toMadridDateTimeString,
} from "../src/lib/twitch/constants.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fallback if .env.local is already loaded or absent
}

const SECRET =
  process.env.TWITCH_EVENTSUB_SECRET ||
  "c8f1d39e5b72a048e91d6c34fa280e71b5692043ca9e28f1b6a7350c4189e472";
const BROADCASTER_ID =
  process.env.TWITCH_BROADCASTER_ID || DEFAULT_TWITCH_BROADCASTER_ID;
const DEFAULT_WEBHOOK_URL = "http://localhost:4321/api/webhooks/twitch";

function printHelp() {
  console.log(`
Twitch EventSub Stream Simulator CLI

Usage:
  node scripts/simulate-stream.ts <command> [options]

Commands:
  start, online               Send signed stream.online webhook to target URL
  stop, offline               Send signed stream.offline webhook to target URL
  update, channel.update      Send signed channel.update webhook to target URL
  db-start                    Directly insert active stream record in Supabase
  db-stop                     Directly end active stream record in Supabase
  db-update                   Directly record channel update & reconcile game in DB
  help                        Show this help message

Options:
  -u, --url <url>             Target webhook URL (default: ${DEFAULT_WEBHOOK_URL})
  -n, --name <name>           Twitch category/game name (default: "ELDEN RING")
  -c, --category-id <id>      Twitch category ID (default: "512953")
  -t, --title <title>         Stream title (default: "Simulated stream update")
  -h, --help                  Show help

Examples:
  node scripts/simulate-stream.ts start
  node scripts/simulate-stream.ts start --url https://your-domain.vercel.app/api/webhooks/twitch
  node scripts/simulate-stream.ts update --name "Dark Souls" --category-id "29093"
  node scripts/simulate-stream.ts db-update --name "Final Fantasy VII" --category-id "12345"
`);
}

function signPayload(
  messageId: string,
  timestamp: string,
  body: string,
): string {
  const message = messageId + timestamp + body;
  return (
    "sha256=" +
    crypto.createHmac("sha256", SECRET).update(message).digest("hex")
  );
}

interface WebhookOptions {
  categoryId?: string;
  categoryName?: string;
  title?: string;
}

async function sendWebhook(
  eventType: "stream.online" | "stream.offline" | "channel.update",
  url: string,
  options?: WebhookOptions,
) {
  const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  let streamId = `${Date.now()}`;
  if (eventType === "stream.offline") {
    try {
      const { createSupabaseAdminClient } =
        await import("../src/lib/supabase-admin.ts");
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("streams")
        .select("twitch_id")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.twitch_id) {
        streamId = String(data.twitch_id);
      }
    } catch {
      // Ignore fallback error
    }
  }

  let eventPayload: Record<string, unknown>;
  let version = "1";

  if (eventType === "stream.online") {
    eventPayload = {
      id: streamId,
      broadcaster_user_id: BROADCASTER_ID,
      broadcaster_user_login: "knekro",
      broadcaster_user_name: "KNekro",
      type: "live",
      started_at: timestamp,
    };
  } else if (eventType === "stream.offline") {
    eventPayload = {
      id: streamId,
      broadcaster_user_id: BROADCASTER_ID,
      broadcaster_user_login: "knekro",
      broadcaster_user_name: "KNekro",
    };
  } else {
    // channel.update
    version = "2";
    eventPayload = {
      broadcaster_user_id: BROADCASTER_ID,
      broadcaster_user_login: "knekro",
      broadcaster_user_name: "KNekro",
      title: options?.title || "Simulated stream update",
      language: "es",
      category_id: options?.categoryId || "512953",
      category_name: options?.categoryName || "ELDEN RING",
    };
  }

  const payload = {
    subscription: {
      id: `sub-${Date.now()}`,
      type: eventType,
      version,
      status: "enabled",
      condition: { broadcaster_user_id: BROADCASTER_ID },
      transport: { method: "webhook", callback: url },
      created_at: timestamp,
    },
    event: eventPayload,
  };

  const rawBody = JSON.stringify(payload);
  const signature = signPayload(messageId, timestamp, rawBody);

  console.log(`Sending signed '${eventType}' webhook to: ${url}`);
  if (eventType === "channel.update") {
    console.log(
      `Payload category: ${eventPayload.category_name} (ID: ${eventPayload.category_id})`,
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "twitch-eventsub-message-id": messageId,
        "twitch-eventsub-message-timestamp": timestamp,
        "twitch-eventsub-message-signature": signature,
        "twitch-eventsub-message-type": "notification",
      },
      body: rawBody,
    });

    if (res.ok) {
      console.log(`Success! Webhook responded with status: ${res.status}`);
      if (eventType === "stream.online") {
        console.log("Knekro is now marked as LIVE (En vivo) in the database.");
      } else if (eventType === "stream.offline") {
        console.log("Stream marked as ENDED (Desconectado) in the database.");
      } else {
        console.log("Channel update processed successfully.");
      }
    } else {
      const errText = await res.text();
      console.error(`Webhook returned error ${res.status}: ${errText}`);
    }
  } catch (err: any) {
    if (
      err.cause?.code === "ECONNREFUSED" ||
      err.message?.includes("fetch failed")
    ) {
      console.error(`\nConnection refused at ${url}.`);
      console.error("Make sure your dev server is running ('pnpm run dev')!");
    } else {
      console.error("Request failed:", err);
    }
  }
}

async function directDbAction(
  action: "start" | "stop" | "update",
  options?: { categoryName?: string; categoryId?: string },
) {
  const { createSupabaseAdminClient } =
    await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  if (action === "start") {
    const now = toMadridDateTimeString();
    await supabase
      .from("streams")
      .update({ ended_at: now })
      .is("ended_at", null);
    const { data, error } = await supabase
      .from("streams")
      .insert({ started_at: now, ended_at: null, twitch_id: Date.now() })
      .select("id, started_at, ended_at, twitch_id")
      .single();

    if (error) {
      console.error("Database insert error:", error);
    } else {
      console.log("Direct DB update successful: Stream started!");
      console.log(data);
      console.log("Reload your browser to see 'En vivo'.");
    }
  } else if (action === "stop") {
    const now = toMadridDateTimeString();
    const { data, error } = await supabase
      .from("streams")
      .update({ ended_at: now })
      .is("ended_at", null)
      .select("id, started_at, ended_at, twitch_id");

    if (error) {
      console.error("Database update error:", error);
    } else {
      console.log("Direct DB update successful: Stream ended!");
      console.log(data);
      console.log("Reload your browser to see 'Desconectado'.");
    }
  } else if (action === "update") {
    const categoryName = options?.categoryName || "ELDEN RING";
    const categoryId = options?.categoryId || "512953";

    const { recordChannelUpdate, reconcileGame } =
      await import("../src/lib/twitch/reconcile-game.ts");

    const updateRecord = await recordChannelUpdate(
      supabase,
      toMadridDateTimeString(),
      categoryId,
      categoryName,
    );
    console.log("Logged channel update record:", updateRecord);

    const reconcileResult = await reconcileGame(
      supabase,
      categoryId,
      categoryName,
    );
    console.log("Reconcile game result:", reconcileResult);
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
        name: {
          type: "string",
          short: "n",
        },
        "category-id": {
          type: "string",
          short: "c",
        },
        title: {
          type: "string",
          short: "t",
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

  const command = positionals[0] || "start";
  const targetUrl = values.url || positionals[1]?.startsWith("http") ? positionals[1] : (values.url || DEFAULT_WEBHOOK_URL);

  if (command === "start" || command === "online") {
    const finalUrl = values.url || (positionals[1]?.startsWith("http") ? positionals[1] : DEFAULT_WEBHOOK_URL);
    await sendWebhook("stream.online", finalUrl);
  } else if (command === "stop" || command === "offline") {
    const finalUrl = values.url || (positionals[1]?.startsWith("http") ? positionals[1] : DEFAULT_WEBHOOK_URL);
    await sendWebhook("stream.offline", finalUrl);
  } else if (command === "update" || command === "channel.update") {
    let categoryName = values.name || "ELDEN RING";
    let categoryId = values["category-id"] || "512953";
    let finalUrl = values.url || DEFAULT_WEBHOOK_URL;

    // Positional fallback compatibility
    if (!values.name && positionals[1] && !positionals[1].startsWith("http")) {
      categoryName = positionals[1];
    }
    if (!values["category-id"] && positionals[2] && !positionals[2].startsWith("http")) {
      categoryId = positionals[2];
    }
    if (!values.url) {
      const urlCandidate = [positionals[1], positionals[2], positionals[3]].find(
        (arg) => arg?.startsWith("http://") || arg?.startsWith("https://"),
      );
      if (urlCandidate) {
        finalUrl = urlCandidate;
      }
    }

    await sendWebhook("channel.update", finalUrl, {
      categoryName,
      categoryId,
      title: values.title,
    });
  } else if (command === "db-start") {
    await directDbAction("start");
  } else if (command === "db-stop") {
    await directDbAction("stop");
  } else if (command === "db-update") {
    const categoryName = values.name || positionals[1];
    const categoryId = values["category-id"] || positionals[2];
    await directDbAction("update", { categoryName, categoryId });
  } else {
    console.log(`Unknown command: '${command}'`);
    printHelp();
  }
}

main();
