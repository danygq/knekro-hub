/**
 * Helper to simulate Twitch EventSub webhook events locally or in production.
 *
 * Usage:
 *   node scripts/simulate-stream.ts start [optional_endpoint_url]
 *   node scripts/simulate-stream.ts stop  [optional_endpoint_url]
 *   node scripts/simulate-stream.ts update [category_name] [category_id] [optional_endpoint_url]
 *   node scripts/simulate-stream.ts db-start
 *   node scripts/simulate-stream.ts db-stop
 *   node scripts/simulate-stream.ts db-update [category_name] [category_id]
 */

import crypto from "node:crypto";

try {
  process.loadEnvFile(".env.local");
} catch {}

const SECRET =
  process.env.TWITCH_EVENTSUB_SECRET ||
  "c8f1d39e5b72a048e91d6c34fa280e71b5692043ca9e28f1b6a7350c4189e472";
const BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID || "152633332";

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
    } catch {}
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
    const now = new Date().toISOString();
    // Close any previous open stream
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
    const now = new Date().toISOString();
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
      new Date().toISOString(),
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
  const command = process.argv[2] || "start";
  const defaultUrl = "http://localhost:4321/api/webhooks/twitch";

  if (command === "start" || command === "online") {
    const targetUrl = process.argv[3] || defaultUrl;
    await sendWebhook("stream.online", targetUrl);
  } else if (command === "stop" || command === "offline") {
    const targetUrl = process.argv[3] || defaultUrl;
    await sendWebhook("stream.offline", targetUrl);
  } else if (command === "update" || command === "channel.update") {
    let categoryName = "ELDEN RING";
    let categoryId = "512953";
    let targetUrl = defaultUrl;

    const arg3 = process.argv[3];
    const arg4 = process.argv[4];
    const arg5 = process.argv[5];

    if (arg3?.startsWith("http://") || arg3?.startsWith("https://")) {
      targetUrl = arg3;
    } else {
      if (arg3) categoryName = arg3;
      if (arg4) categoryId = arg4;
      if (arg5?.startsWith("http://") || arg5?.startsWith("https://")) {
        targetUrl = arg5;
      }
    }

    await sendWebhook("channel.update", targetUrl, {
      categoryName,
      categoryId,
    });
  } else if (command === "db-start") {
    await directDbAction("start");
  } else if (command === "db-stop") {
    await directDbAction("stop");
  } else if (command === "db-update") {
    const categoryName = process.argv[3];
    const categoryId = process.argv[4];
    await directDbAction("update", { categoryName, categoryId });
  } else {
    console.log("Usage:");
    console.log(
      "  node scripts/simulate-stream.ts start [url]                                 - Sends signed stream.online webhook",
    );
    console.log(
      "  node scripts/simulate-stream.ts stop [url]                                  - Sends signed stream.offline webhook",
    );
    console.log(
      "  node scripts/simulate-stream.ts update [category_name] [category_id] [url]   - Sends signed channel.update webhook",
    );
    console.log(
      "  node scripts/simulate-stream.ts db-start                                    - Directly sets live in Supabase",
    );
    console.log(
      "  node scripts/simulate-stream.ts db-stop                                     - Directly ends stream in Supabase",
    );
    console.log(
      "  node scripts/simulate-stream.ts db-update [category_name] [category_id]        - Directly records update and reconciles game",
    );
  }
}

main();
