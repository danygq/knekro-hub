/**
 * Helper to simulate Twitch EventSub webhook events locally or in production.
 *
 * Usage:
 *   node scripts/simulate-stream.ts start [optional_endpoint_url]
 *   node scripts/simulate-stream.ts stop  [optional_endpoint_url]
 *   node scripts/simulate-stream.ts db-start
 *   node scripts/simulate-stream.ts db-stop
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

async function sendWebhook(
  eventType: "stream.online" | "stream.offline",
  url: string,
) {
  const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const payload = {
    subscription: {
      id: `sub-${Date.now()}`,
      type: eventType,
      version: "1",
      status: "enabled",
      condition: { broadcaster_user_id: BROADCASTER_ID },
      transport: { method: "webhook", callback: url },
      created_at: timestamp,
    },
    event:
      eventType === "stream.online"
        ? {
            id: `stream-${Date.now()}`,
            broadcaster_user_id: BROADCASTER_ID,
            broadcaster_user_login: "knekro",
            broadcaster_user_name: "KNekro",
            type: "live",
            started_at: timestamp,
          }
        : {
            broadcaster_user_id: BROADCASTER_ID,
            broadcaster_user_login: "knekro",
            broadcaster_user_name: "KNekro",
          },
  };

  const rawBody = JSON.stringify(payload);
  const signature = signPayload(messageId, timestamp, rawBody);

  console.log(`Sending signed '${eventType}' webhook to: ${url}`);

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
      } else {
        console.log("Stream marked as ENDED (Desconectado) in the database.");
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

async function directDbAction(action: "start" | "stop") {
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
      .insert({ started_at: now, ended_at: null })
      .select("id, started_at, ended_at")
      .single();

    if (error) {
      console.error("Database insert error:", error);
    } else {
      console.log("Direct DB update successful: Stream started!");
      console.log(data);
      console.log("Reload your browser to see 'En vivo'.");
    }
  } else {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("streams")
      .update({ ended_at: now })
      .is("ended_at", null)
      .select("id, started_at, ended_at");

    if (error) {
      console.error("Database update error:", error);
    } else {
      console.log("Direct DB update successful: Stream ended!");
      console.log(data);
      console.log("Reload your browser to see 'Desconectado'.");
    }
  }
}

async function main() {
  const command = process.argv[2] || "start";
  const targetUrl =
    process.argv[3] || "http://localhost:4321/api/webhooks/twitch";

  if (command === "start" || command === "online") {
    await sendWebhook("stream.online", targetUrl);
  } else if (command === "stop" || command === "offline") {
    await sendWebhook("stream.offline", targetUrl);
  } else if (command === "db-start") {
    await directDbAction("start");
  } else if (command === "db-stop") {
    await directDbAction("stop");
  } else {
    console.log("Usage:");
    console.log(
      "  node scripts/simulate-stream.ts start [url]    - Sends signed stream.online webhook",
    );
    console.log(
      "  node scripts/simulate-stream.ts stop [url]     - Sends signed stream.offline webhook",
    );
    console.log(
      "  node scripts/simulate-stream.ts db-start       - Directly sets live in Supabase",
    );
    console.log(
      "  node scripts/simulate-stream.ts db-stop        - Directly ends stream in Supabase",
    );
  }
}

main();
