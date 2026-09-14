import type { APIRoute } from "astro";
import { verifyTwitchSignature } from "@/lib/twitch/verify-signature";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getHelixStream } from "@/lib/twitch/helix";
import {
  reconcileGame,
  recordChannelUpdate,
} from "@/lib/twitch/reconcile-game";
import {
  DEFAULT_TWITCH_BROADCASTER_ID,
  toMadridDateTimeString,
} from "@/lib/twitch/constants";

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
    category_id?: string;
    category_name?: string;
    title?: string;
    language?: string;
  };
}

export const POST: APIRoute = async ({ request }) => {
  const secret =
    import.meta?.env?.TWITCH_EVENTSUB_SECRET ||
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

  console.log(
    `[Twitch EventSub] Incoming webhook request: messageType=${messageType}, messageId=${messageId}, timestamp=${messageTimestamp}`,
  );

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
      `[Twitch EventSub] Failed signature verification or stale timestamp. messageId=${messageId}, timestamp=${messageTimestamp}, signaturePresent=${Boolean(signature)}`,
    );
    return new Response("Forbidden: Invalid signature or timestamp", {
      status: 403,
    });
  }

  let body: TwitchEventSubBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("[Twitch EventSub] Bad Request: Invalid JSON body");
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }

  // 1. Webhook subscription verification challenge
  if (messageType === "webhook_callback_verification") {
    if (typeof body.challenge === "string") {
      console.log(
        `[Twitch EventSub] Responding to verification challenge for subscription ${body.subscription?.id} (type: ${body.subscription?.type}, version: ${body.subscription?.version})`,
      );
      return new Response(body.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    console.error(
      "[Twitch EventSub] Verification callback missing challenge string",
    );
    return new Response("Missing challenge string", { status: 400 });
  }

  // 2. Revocation notice
  if (messageType === "revocation") {
    console.warn(
      `[Twitch EventSub] Subscription ${body.subscription.id} revoked. Type: ${body.subscription.type}, status: ${body.subscription.status}`,
    );
    return new Response(null, { status: 204 });
  }

  // 3. Notification events
  if (messageType === "notification") {
    const eventType = body.subscription.type;
    const event = body.event;

    if (!event) {
      console.error(
        "[Twitch EventSub] Notification payload missing event object",
      );
      return new Response("Missing event payload", { status: 400 });
    }

    console.log(
      `[Twitch EventSub] Processing notification event '${eventType}' for broadcaster ${event.broadcaster_user_name || event.broadcaster_user_id}`,
    );

    const supabaseAdmin = createSupabaseAdminClient();

    if (eventType === "stream.online") {
      // Use started_at formatted to Europe/Madrid local time
      const rawStartedAt =
        event.started_at || messageTimestamp || new Date().toISOString();
      const startedAt = toMadridDateTimeString(rawStartedAt);
      const twitchId = event.id ?? null;

      console.log(
        `[Twitch EventSub] stream.online: twitchId=${twitchId}, rawStartedAt=${rawStartedAt}, startedAt (Europe/Madrid)=${startedAt}`,
      );

      // Check if this stream start was already recorded (idempotency guard)
      if (twitchId) {
        const { data: existingStream } = await supabaseAdmin
          .from("streams")
          .select("id")
          .eq("twitch_id", twitchId)
          .maybeSingle();

        if (existingStream) {
          console.log(
            `[Twitch EventSub] Stream with twitch_id=${twitchId} already recorded (id: ${existingStream.id}), skipping.`,
          );
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
          console.log(
            `[Twitch EventSub] Stream already active with matching started_at=${startedAt}, skipping.`,
          );
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

      const { data: insertedStream, error: insertError } = await supabaseAdmin
        .from("streams")
        .insert(newStream)
        .select("id, started_at, twitch_id")
        .single();

      if (insertError) {
        console.error(
          "[Twitch EventSub] Failed to insert stream.online record:",
          insertError,
        );
        return new Response("Database error", { status: 500 });
      }

      console.log(
        `[Twitch EventSub] Successfully inserted stream.online: id=${insertedStream.id}, started_at=${insertedStream.started_at}`,
      );

      // Query broadcaster's initial stream category via Helix API
      try {
        const broadcasterId =
          event.broadcaster_user_id ||
          import.meta?.env?.TWITCH_BROADCASTER_ID ||
          process.env.TWITCH_BROADCASTER_ID ||
          DEFAULT_TWITCH_BROADCASTER_ID;

        console.log(
          `[Twitch EventSub] Resolving current stream category via Helix for broadcaster ${broadcasterId}...`,
        );
        const currentStream = await getHelixStream(broadcasterId);
        if (
          currentStream &&
          (currentStream.game_id || currentStream.game_name)
        ) {
          const categoryId = currentStream.game_id || null;
          const categoryName = currentStream.game_name || null;

          console.log(
            `[Twitch EventSub] Helix category resolved on stream.online: "${categoryName}" (ID: ${categoryId})`,
          );

          await recordChannelUpdate(
            supabaseAdmin,
            startedAt,
            categoryId,
            categoryName,
          );

          const result = await reconcileGame(
            supabaseAdmin,
            categoryId,
            categoryName,
          );
          console.log(
            `[Twitch EventSub] Stream start game reconciliation for "${categoryName}": ${result.action}`,
          );
        } else {
          console.log(
            `[Twitch EventSub] Helix returned no stream category for broadcaster ${broadcasterId} on stream.online`,
          );
        }
      } catch (helixErr) {
        console.error(
          "[Twitch EventSub] Error resolving Helix stream category on stream.online:",
          helixErr,
        );
      }

      return new Response(null, { status: 204 });
    }

    if (eventType === "channel.update") {
      const categoryId = event.category_id ?? null;
      const categoryName = event.category_name ?? null;
      const eventTimestamp = toMadridDateTimeString(messageTimestamp);

      console.log(
        `[Twitch EventSub] channel.update received: category="${categoryName}" (ID: ${categoryId}), title="${event.title || ""}", eventTimestamp=${eventTimestamp}`,
      );

      // 1. Record category transition in twitch_channel_update
      await recordChannelUpdate(
        supabaseAdmin,
        eventTimestamp,
        categoryId,
        categoryName,
      );

      // 2. Reconcile game in public.games
      const result = await reconcileGame(
        supabaseAdmin,
        categoryId,
        categoryName,
      );
      console.log(
        `[Twitch EventSub] channel.update game reconciliation for "${categoryName}": ${result.action}`,
      );

      return new Response(null, { status: 204 });
    }

    if (eventType === "stream.offline") {
      const endedAt = toMadridDateTimeString(messageTimestamp);
      const twitchId = event.id ?? null;

      console.log(
        `[Twitch EventSub] stream.offline received: twitchId=${twitchId}, ended_at (Europe/Madrid)=${endedAt}`,
      );

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

        // Fallback: If no row matched by twitch_id, close any currently open stream
        if (!updatedRows || updatedRows.length === 0) {
          console.log(
            `[Twitch EventSub] stream.offline: No row found with twitch_id=${twitchId}, closing any open stream.`,
          );
          await supabaseAdmin
            .from("streams")
            .update({ ended_at: endedAt })
            .is("ended_at", null);
        } else {
          console.log(
            `[Twitch EventSub] Closed stream id=${updatedRows[0]?.id} with ended_at=${endedAt}`,
          );
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
        console.log(
          `[Twitch EventSub] Closed active stream with ended_at=${endedAt}`,
        );
      }

      return new Response(null, { status: 204 });
    }

    console.warn(`[Twitch EventSub] Unhandled eventType: ${eventType}`);
    return new Response(null, { status: 204 });
  }

  console.warn(`[Twitch EventSub] Unhandled messageType: ${messageType}`);
  return new Response("Unhandled message type", { status: 400 });
};
