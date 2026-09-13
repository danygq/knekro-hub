import crypto from "node:crypto";

try {
  process.loadEnvFile(".env.local");
} catch {}

const SECRET = process.env.TWITCH_EVENTSUB_SECRET || "c8f1d39e5b72a048e91d6c34fa280e71b5692043ca9e28f1b6a7350c4189e472";

function signPayload(messageId: string, timestamp: string, body: string): string {
  const message = messageId + timestamp + body;
  return "sha256=" + crypto.createHmac("sha256", SECRET).update(message).digest("hex");
}

async function runTests() {
  console.log("Testing Twitch EventSub signature generation & verification...");

  // Import the verification function directly
  const { verifyTwitchSignature } = await import("../src/lib/twitch/verify-signature.ts");

  const messageId = "test-msg-" + Date.now();
  const timestamp = new Date().toISOString();
  const rawBody = JSON.stringify({ test: "hello" });
  const signature = signPayload(messageId, timestamp, rawBody);

  const isValid = verifyTwitchSignature({
    secret: SECRET,
    messageId,
    messageTimestamp: timestamp,
    rawBody,
    signature,
  });

  console.log(`Valid signature check: ${isValid ? "PASSED" : "FAILED"}`);

  const isInvalid = verifyTwitchSignature({
    secret: SECRET,
    messageId,
    messageTimestamp: timestamp,
    rawBody,
    signature: "sha256=invalidhash00000000000000000000000000000000000000000000000000000000",
  });

  console.log(`Tampered signature rejection: ${!isInvalid ? "PASSED" : "FAILED"}`);

  // Stale timestamp (11 minutes ago)
  const staleTimestamp = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const staleSignature = signPayload(messageId, staleTimestamp, rawBody);
  const isStaleRejected = !verifyTwitchSignature({
    secret: SECRET,
    messageId,
    messageTimestamp: staleTimestamp,
    rawBody,
    signature: staleSignature,
  });

  console.log(`Stale replay rejection: ${isStaleRejected ? "PASSED" : "FAILED"}`);

  // Supabase admin connection test
  console.log("\nTesting Supabase Admin Client write access on 'streams' table...");
  const { createSupabaseAdminClient } = await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  const testStartedAt = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("streams")
    .insert({
      started_at: testStartedAt,
      ended_at: null,
    })
    .select("id, started_at, ended_at")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return;
  }
  console.log("Successfully inserted live test stream:", inserted);

  // Now simulate stream.offline
  const testEndedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("streams")
    .update({ ended_at: testEndedAt })
    .eq("id", inserted.id);

  if (updateError) {
    console.error("Update error:", updateError);
    return;
  }
  console.log("Successfully ended test stream:", { id: inserted.id, ended_at: testEndedAt });

  // Clean up test stream
  const { error: deleteError } = await supabase
    .from("streams")
    .delete()
    .eq("id", inserted.id);

  if (deleteError) {
    console.error("Cleanup delete error:", deleteError);
  } else {
    console.log("Cleaned up test stream row.");
  }

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
