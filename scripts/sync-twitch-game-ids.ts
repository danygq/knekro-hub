/**
 * CLI utility to synchronize twitch_game_id for games in the database.
 *
 * Fetches all games where twitch_game_id IS NULL, queries the Twitch Helix
 * Games API (https://api.twitch.tv/helix/games?name=...) in batches, and
 * updates the twitch_game_id column for every exact match found.
 *
 * Usage:
 *   node scripts/sync-twitch-game-ids.ts [options]
 *   node scripts/sync-twitch-game-ids.ts --dry-run --limit 20
 *   node scripts/sync-twitch-game-ids.ts --batch-size 30 --delay 500
 *   node scripts/sync-twitch-game-ids.ts --help
 */

import { parseArgs } from "node:util";

// Load .env and .env.local if present
for (const envFile of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // file absent or already loaded — ignore
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Twitch Game ID Sync Script

Fetches all games missing twitch_game_id, queries the Twitch Helix Games API
by name, and backfills the database column for every exact-name match found.

Usage:
  node scripts/sync-twitch-game-ids.ts [options]

Options:
  -d, --dry-run              Simulate without writing to the database
  -l, --limit <number>       Process only the first N unlinked games
  -b, --batch-size <number>  Game names per Twitch API call (default: 50, max: 100)
      --delay <ms>           Delay in ms between batches (default: 200)
  -h, --help                 Show this help message

Examples:
  node scripts/sync-twitch-game-ids.ts --help
  node scripts/sync-twitch-game-ids.ts --dry-run --limit 10
  node scripts/sync-twitch-game-ids.ts --batch-size 30 --delay 500
  node scripts/sync-twitch-game-ids.ts
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbGame {
  id: number;
  name: string;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
}

interface HelixGameItem {
  id: string;
  name: string;
}

// ── Twitch Auth ───────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in environment (.env.local)",
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  console.log("[Auth] Requesting Twitch App Access Token...");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
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
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };

  console.log("[Auth] Token acquired successfully.");
  return cachedToken.token;
}

// ── Twitch Helix Games Lookup ─────────────────────────────────────────────────

async function fetchHelixGames(names: string[]): Promise<HelixGameItem[]> {
  if (names.length === 0) return [];

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const token = await getAppAccessToken();

  const url = new URL("https://api.twitch.tv/helix/games");
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed) url.searchParams.append("name", trimmed);
  }

  if (!url.searchParams.has("name")) return [];

  const res = await fetch(url.toString(), {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Helix /games request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { data: HelixGameItem[] };
  return json.data ?? [];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let opts: {
    "dry-run": boolean;
    limit?: string;
    "batch-size"?: string;
    delay?: string;
    help: boolean;
  };

  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "dry-run": { type: "boolean", short: "d", default: false },
        limit: { type: "string", short: "l" },
        "batch-size": { type: "string", short: "b" },
        delay: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
    opts = values as typeof opts;
  } catch (e) {
    console.error("[Error] Failed to parse arguments:", (e as Error).message);
    printHelp();
    process.exit(1);
  }

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const isDryRun = opts["dry-run"] ?? false;
  const limitCount = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const batchSize = Math.min(
    opts["batch-size"] ? parseInt(opts["batch-size"], 10) : 50,
    100,
  );
  const delayMs = opts.delay ? parseInt(opts.delay, 10) : 200;

  if (limitCount !== undefined && (isNaN(limitCount) || limitCount <= 0)) {
    console.error("[Error] --limit must be a positive integer.");
    process.exit(1);
  }
  if (isNaN(batchSize) || batchSize <= 0) {
    console.error("[Error] --batch-size must be a positive integer (max 100).");
    process.exit(1);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Twitch Game ID Sync");
  console.log(`  Mode     : ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`  Batch    : ${batchSize} names/request`);
  console.log(`  Delay    : ${delayMs}ms between batches`);
  if (limitCount !== undefined) {
    console.log(`  Limit    : first ${limitCount} unlinked games`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Supabase setup ────────────────────────────────────────────────────────
  const { createSupabaseAdminClient } =
    await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  // ── Load existing twitch_game_id values to prevent unique constraint collisions
  console.log("\n[DB] Loading existing twitch_game_id assignments...");
  const { data: existingGames, error: existingError } = await supabase
    .from("games")
    .select("id, name, twitch_game_id")
    .not("twitch_game_id", "is", null);

  if (existingError) {
    console.error(
      "[Error] Failed to load existing game mappings:",
      existingError.message,
    );
    process.exit(1);
  }

  // Map twitch_game_id -> db game name for collision logging
  const assignedTwitchIds = new Map<string, string>();
  for (const g of existingGames ?? []) {
    if (g.twitch_game_id) {
      assignedTwitchIds.set(g.twitch_game_id, g.name ?? "(unknown)");
    }
  }
  console.log(
    `[DB] ${assignedTwitchIds.size} games already have twitch_game_id set.`,
  );

  // ── Fetch unlinked games from database ────────────────────────────────────
  console.log("\n[DB] Fetching games with missing twitch_game_id...");
  let query = supabase
    .from("games")
    .select("id, name")
    .is("twitch_game_id", null)
    .order("id", { ascending: true });

  if (limitCount !== undefined) {
    query = query.limit(limitCount);
  }

  const { data: unlinkedGames, error: fetchError } = await query;

  if (fetchError) {
    console.error(
      "[Error] Failed to fetch unlinked games:",
      fetchError.message,
    );
    process.exit(1);
  }

  const games = (unlinkedGames ?? []) as DbGame[];

  if (games.length === 0) {
    console.log(
      "[DB] No games found with missing twitch_game_id. Nothing to do.",
    );
    process.exit(0);
  }

  console.log(`[DB] ${games.length} game(s) to process.\n`);

  // ── Counters ───────────────────────────────────────────────────────────────
  const startTime = Date.now();
  let updatedCount = 0;
  let notFoundCount = 0;
  let collisionCount = 0;
  let errorCount = 0;
  const notFoundNames: string[] = [];

  // ── Process in batches ────────────────────────────────────────────────────
  const batches = chunk(games, batchSize);
  console.log(
    `[Sync] Processing ${batches.length} batch(es) of up to ${batchSize}...\n`,
  );

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchLabel = `Batch ${batchIdx + 1}/${batches.length}`;
    const batchNames = batch.map((g) => g.name);

    console.log(
      `[${batchLabel}] Querying Twitch for ${batch.length} game(s): ${batchNames
        .slice(0, 5)
        .join(", ")}${batch.length > 5 ? "..." : ""}`,
    );

    let helixGames: HelixGameItem[];
    try {
      helixGames = await fetchHelixGames(batchNames);
    } catch (err) {
      console.error(
        `[${batchLabel}] [ERROR] Twitch API call failed:`,
        (err as Error).message,
      );
      errorCount += batch.length;
      for (const g of batch) notFoundNames.push(g.name);
      if (batchIdx < batches.length - 1) await sleep(delayMs);
      continue;
    }

    // Build a case-insensitive lookup map from Twitch response
    const twitchByNameLower = new Map<string, HelixGameItem>();
    for (const item of helixGames) {
      twitchByNameLower.set(item.name.trim().toLowerCase(), item);
    }

    // Match each game in the batch against Twitch results
    for (const dbGame of batch) {
      const nameLower = dbGame.name.trim().toLowerCase();
      const twitchMatch = twitchByNameLower.get(nameLower);

      if (!twitchMatch) {
        console.log(
          `  [NOT FOUND] "${dbGame.name}" (id: ${dbGame.id}) — no exact match on Twitch`,
        );
        notFoundCount++;
        notFoundNames.push(dbGame.name);
        continue;
      }

      // Collision check
      if (assignedTwitchIds.has(twitchMatch.id)) {
        const owner = assignedTwitchIds.get(twitchMatch.id);
        console.log(
          `  [COLLISION] "${dbGame.name}" (id: ${dbGame.id}) — twitch_game_id "${twitchMatch.id}" already assigned to "${owner}". Skipping.`,
        );
        collisionCount++;
        continue;
      }

      if (isDryRun) {
        console.log(
          `  [DRY-RUN]  "${dbGame.name}" (id: ${dbGame.id}) → twitch_game_id: "${twitchMatch.id}" (would update)`,
        );
        // Register in collision map so later duplicates in the same run are caught
        assignedTwitchIds.set(twitchMatch.id, dbGame.name);
        updatedCount++;
        continue;
      }

      // Live update
      const { error: updateError } = await supabase
        .from("games")
        .update({ twitch_game_id: twitchMatch.id })
        .eq("id", dbGame.id);

      if (updateError) {
        console.error(
          `  [ERROR]    "${dbGame.name}" (id: ${dbGame.id}) — update failed: ${updateError.message}`,
        );
        errorCount++;
        continue;
      }

      console.log(
        `  [UPDATED]  "${dbGame.name}" (id: ${dbGame.id}) → twitch_game_id: "${twitchMatch.id}"`,
      );
      assignedTwitchIds.set(twitchMatch.id, dbGame.name);
      updatedCount++;
    }

    if (batchIdx < batches.length - 1) {
      await sleep(delayMs);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sync Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Mode      : ${isDryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`  Evaluated : ${games.length}`);
  console.log(`  Updated   : ${updatedCount}${isDryRun ? " (simulated)" : ""}`);
  console.log(`  Not Found : ${notFoundCount}`);
  console.log(`  Collisions: ${collisionCount}`);
  console.log(`  Errors    : ${errorCount}`);
  console.log(`  Duration  : ${durationSec}s`);

  if (notFoundNames.length > 0) {
    console.log("\n  ── Games not found on Twitch (review manually) ──");
    for (const name of notFoundNames) {
      console.log(`    - ${name}`);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n[Fatal Error]", err instanceof Error ? err.message : err);
  process.exit(1);
});
