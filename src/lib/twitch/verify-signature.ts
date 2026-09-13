import crypto from "node:crypto";

export interface VerifySignatureParams {
  secret: string;
  messageId: string | null;
  messageTimestamp: string | null;
  rawBody: string;
  signature: string | null;
}

/**
 * Verifies the Twitch EventSub message signature according to the official spec:
 * HMAC-SHA256(secret, messageId + messageTimestamp + rawBody)
 *
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events/#verifying-the-event-message
 */
export function verifyTwitchSignature(params: VerifySignatureParams): boolean {
  const { secret, messageId, messageTimestamp, rawBody, signature } = params;

  if (!secret || !messageId || !messageTimestamp || !signature) {
    return false;
  }

  // Check timestamp drift to prevent replay attacks (10 minutes tolerance)
  const timestamp = new Date(messageTimestamp).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > 10 * 60 * 1000) {
    return false;
  }

  const message = messageId + messageTimestamp + rawBody;
  const computedHmac =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(message).digest("hex");

  try {
    const expectedBuffer = Buffer.from(computedHmac, "utf8");
    const actualBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
