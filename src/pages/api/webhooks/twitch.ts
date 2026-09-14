import type { APIRoute } from "astro";
import { verifyTwitchSignature } from "@/lib/twitch/verify-signature";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const prerender = false;

interface TwitchEventSubBody {
  challenge?: string;
  subscription: {
    id: string;
    type: string;
    version: string;
    status: string;
    condition: Record<string, string>;
  };
  event?: {
    id?: string;
    broadcaster_user_id: string;
    broadcaster_user_login: string;
    broadcaster_user_name: string;
    type?: string;
    started_at?: string;
  };
}

export const POST: APIRoute = async ({ request }) => {
  const secret =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.TWITCH_EVENTSUB_SECRET) ||
    process.env.TWITCH_EVENTSUB_SECRET;

  if (!secret) {
    console.error(
      "[Twitch EventSub] Missing TWITCH_EVENTSUB_SECRET environment variable",
    );
    return new Response("Server configuration error", { status: 500 });
  }

  const messageId = request.headers.get("twitch-eventsub-message-id");
  const messageTimestamp = request.headers.get(
    "twitch-eventsub-message-timestamp",
  );
  const signature = request.headers.get("twitch-eventsub-message-signature");
  const messageType = request.headers.get("twitch-eventsub-message-type");

  const rawBody = await request.text();

  const isValid = verifyTwitchSignature({
    secret,
    messageId,
    messageTimestamp,
    rawBody,
    signature,
  });

  if (!isValid) {
    console.warn(
      "[Twitch EventSub] Failed signature verification or stale timestamp",
    );
    return new Response("Forbidden: Invalid signature or timestamp", {
      status: 403,
    });
  }

  let body: TwitchEventSubBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }

  // 1. Webhook subscription verification challenge
  if (messageType === "webhook_callback_verification") {
    if (typeof body.challenge === "string") {
      return new Response(body.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Missing challenge string", { status: 400 });
  }

  // 2. Revocation notice
  if (messageType === "revocation") {
    console.warn(
      `[Twitch EventSub] Subscription ${body.subscription.id} revoked. Type: ${body.subscription.type}`,
    );
    return new Response(null, { status: 204 });
  }

  // 3. Notification events
  if (messageType === "notification") {
    const eventType = body.subscription.type;
    const event = body.event;

    if (!event) {
      return new Response("Missing event payload", { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    if (eventType === "stream.online") {
      // Use exact started_at provided by Twitch in event payload
      const startedAt = event.started_at || messageTimestamp || new Date().toISOString();
      const twitchId = event.id ?? null;

      // Check if this stream start was already recorded (idempotency guard)
      if (twitchId) {
        const { data: existingStream } = await supabaseAdmin
          .from("streams")
          .select("id")
          .eq("twitch_id", twitchId)
          .maybeSingle();

        if (existingStream) {
          return new Response(null, { status: 204 });
        }
      } else {
        const { data: latestStream } = await supabaseAdmin
          .from("streams")
          .select("id, started_at, ended_at")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (
          latestStream &&
          latestStream.started_at === startedAt &&
          !latestStream.ended_at
        ) {
          return new Response(null, { status: 204 });
        }
      }

      // Close any previously unclosed stream row before inserting the new live stream
      await supabaseAdmin
        .from("streams")
        .update({ ended_at: startedAt })
        .is("ended_at", null);

      const newStream: Record<string, unknown> = {
        started_at: startedAt,
        ended_at: null,
      };

      if (twitchId) {
        newStream.twitch_id = twitchId;
      }

      const { error: insertError } = await supabaseAdmin
        .from("streams")
        .insert(newStream);

      if (insertError) {
        console.error(
          "[Twitch EventSub] Failed to insert stream.online record:",
          insertError,
        );
        return new Response("Database error", { status: 500 });
      }

      return new Response(null, { status: 204 });
    }

    if (eventType === "stream.offline") {
      const endedAt = messageTimestamp || new Date().toISOString();
      const twitchId = event.id ?? null;

      if (twitchId) {
        // Target the exact stream row by its twitch_id
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from("streams")
          .update({ ended_at: endedAt })
          .eq("twitch_id", twitchId)
          .select("id");

        if (updateError) {
          console.error(
            "[Twitch EventSub] Failed to update stream.offline record by twitch_id:",
            updateError,
          );
          return new Response("Database error", { status: 500 });
        }

        // Fallback: If no row matched by twitch_id (e.g. stream inserted prior to tracking twitch_id),
        // close any currently open stream
        if (!updatedRows || updatedRows.length === 0) {
          await supabaseAdmin
            .from("streams")
            .update({ ended_at: endedAt })
            .is("ended_at", null);
        }
      } else {
        // Fallback when id is not provided
        const { error: updateError } = await supabaseAdmin
          .from("streams")
          .update({ ended_at: endedAt })
          .is("ended_at", null);

        if (updateError) {
          console.error(
            "[Twitch EventSub] Failed to update stream.offline record:",
            updateError,
          );
          return new Response("Database error", { status: 500 });
        }
      }

      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 204 });
  }

  return new Response("Unhandled message type", { status: 400 });
};
