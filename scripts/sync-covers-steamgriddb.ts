/**
 * CLI utility to retroactively populate cover_url for games in the database
 * using SteamGridDB with an automated IGDB fallback.
 *
 * For each game with cover_url = null (or all games when --force is passed):
 *   1. Primary lookup: SteamGridDB 600×900 grid image
 *   2. Fallback lookup: IGDB v4 search by name → cover.image_id (t_cover_big webp)
 *
 * Follows the same pattern as scripts/sync-twitch-game-ids.ts.
 *
 * Usage:
 *   node scripts/sync-covers-steamgriddb.ts [options]
 *   node scripts/sync-covers-steamgriddb.ts --dry-run
 *   node scripts/sync-covers-steamgriddb.ts --force
 *   node scripts/sync-covers-steamgriddb.ts --delay 500 --limit 10
 *   node scripts/sync-covers-steamgriddb.ts --help
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
Game Cover Sync Script (SteamGridDB with IGDB fallback)

For each game in the database that is missing cover_url (or all games with --force),
fetches the cover image using:
  1. SteamGridDB (600×900 grid)
  2. IGDB fallback (t_cover_big webp via Twitch OAuth)

Usage:
  node scripts/sync-covers-steamgriddb.ts [options]

Options:
  -d, --dry-run      Simulate without writing to the database
  -f, --force        Process all games, even those with an existing cover_url
  -l, --limit <n>    Process only the first N games
      --delay <ms>   Delay in ms between API calls (default: 300)
  -h, --help         Show this help message

Environment:
  STEAMGRIDDB_API_KEY   Optional/Recommended. SteamGridDB API key.
  TWITCH_CLIENT_ID      Optional/Recommended. Twitch client ID for IGDB fallback.
  TWITCH_CLIENT_SECRET  Optional/Recommended. Twitch client secret for IGDB fallback.

Examples:
  node scripts/sync-covers-steamgriddb.ts --help
  node scripts/sync-covers-steamgriddb.ts --dry-run
  node scripts/sync-covers-steamgriddb.ts --force --dry-run --limit 5
  node scripts/sync-covers-steamgriddb.ts
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let opts: {
    "dry-run": boolean;
    force: boolean;
    limit?: string;
    delay?: string;
    help: boolean;
  };

  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "dry-run": { type: "boolean", short: "d", default: false },
        force: { type: "boolean", short: "f", default: false },
        limit: { type: "string", short: "l" },
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

  // ── Validate env ──────────────────────────────────────────────────────────
  const hasSgdbKey = Boolean(process.env.STEAMGRIDDB_API_KEY);
  const hasTwitchCreds = Boolean(
    process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET,
  );

  if (!hasSgdbKey && !hasTwitchCreds) {
    console.error(
      "[Error] Neither STEAMGRIDDB_API_KEY nor TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET are set. Please provide at least one provider's credentials in .env.local.",
    );
    process.exit(1);
  }

  if (!hasSgdbKey) {
    console.warn(
      "[Warning] STEAMGRIDDB_API_KEY is not set. Only IGDB fallback will be used.",
    );
  }
  if (!hasTwitchCreds) {
    console.warn(
      "[Warning] TWITCH_CLIENT_ID and/or TWITCH_CLIENT_SECRET not set. IGDB fallback will be disabled.",
    );
  }

  const isDryRun = opts["dry-run"] ?? false;
  const isForce = opts.force ?? false;
  const limitCount = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const delayMs = opts.delay ? parseInt(opts.delay, 10) : 300;

  if (limitCount !== undefined && (isNaN(limitCount) || limitCount <= 0)) {
    console.error("[Error] --limit must be a positive integer.");
    process.exit(1);
  }
  if (isNaN(delayMs) || delayMs < 0) {
    console.error("[Error] --delay must be a non-negative integer (ms).");
    process.exit(1);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Game Cover Sync (SteamGridDB + IGDB Fallback)");
  console.log(`  Mode     : ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(
    `  Scope    : ${isForce ? "ALL games" : "games with cover_url = null"}`,
  );
  console.log(`  Delay    : ${delayMs}ms between API calls`);
  if (limitCount !== undefined) {
    console.log(`  Limit    : first ${limitCount} games`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Supabase setup ────────────────────────────────────────────────────────
  const { createSupabaseAdminClient } =
    await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  // ── Import unified cover resolver ─────────────────────────────────────────
  const { resolveGameCover } = await import("../src/lib/covers.ts");

  // ── Fetch target games ────────────────────────────────────────────────────
  console.log("\n[DB] Fetching target games...");
  let query = supabase
    .from("games")
    .select("id, name, cover_url")
    .order("id", { ascending: true });

  if (!isForce) {
    query = query.is("cover_url", null);
  }

  if (limitCount !== undefined) {
    query = query.limit(limitCount);
  }

  const { data: games, error: fetchError } = await query;

  if (fetchError) {
    console.error("[Error] Failed to fetch games:", fetchError.message);
    process.exit(1);
  }

  if (!games || games.length === 0) {
    console.log("[DB] No games to process. Nothing to do.");
    process.exit(0);
  }

  console.log(`[DB] ${games.length} game(s) to process.\n`);

  // ── Counters ───────────────────────────────────────────────────────────────
  const startTime = Date.now();
  let updatedCount = 0;
  let sgdbCount = 0;
  let igdbCount = 0;
  let skippedCount = 0; // no match from either provider
  let alreadySetCount = 0; // cover_url already identical
  let errorCount = 0;

  // ── Process each game ─────────────────────────────────────────────────────
  for (const game of games) {
    const coverResult = await resolveGameCover(game.name ?? "");

    if (!coverResult) {
      console.log(
        `[SYNC] ${game.id} | ${game.name} → null (no SteamGridDB or IGDB match)`,
      );
      skippedCount++;
    } else if (coverResult.url === game.cover_url) {
      console.log(`[SYNC] ${game.id} | ${game.name} → already set, skipping`);
      alreadySetCount++;
    } else if (isDryRun) {
      console.log(
        `[DRY-RUN] ${game.id} | ${game.name} → ${coverResult.url} (source: ${coverResult.source})`,
      );
      if (coverResult.source === "steamgriddb") {
        sgdbCount++;
      } else {
        igdbCount++;
      }
      updatedCount++;
    } else {
      const { error: updateError } = await supabase
        .from("games")
        .update({ cover_url: coverResult.url })
        .eq("id", game.id);

      if (updateError) {
        console.error(
          `[ERROR] ${game.id} | ${game.name} — update failed: ${updateError.message}`,
        );
        errorCount++;
      } else {
        console.log(
          `[SYNC] ${game.id} | ${game.name} → ${coverResult.url} (source: ${coverResult.source})`,
        );
        if (coverResult.source === "steamgriddb") {
          sgdbCount++;
        } else {
          igdbCount++;
        }
        updatedCount++;
      }
    }

    await sleep(delayMs);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sync Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Mode       : ${isDryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`  Evaluated  : ${games.length}`);
  console.log(
    `  Updated    : ${updatedCount}${isDryRun ? " (simulated)" : ""}`,
  );
  console.log(`    - SteamGridDB : ${sgdbCount}`);
  console.log(`    - IGDB        : ${igdbCount}`);
  console.log(`  Skipped    : ${skippedCount} (no match on either provider)`);
  console.log(`  Already OK : ${alreadySetCount}`);
  console.log(`  Errors     : ${errorCount}`);
  console.log(`  Duration   : ${durationSec}s`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n[Fatal Error]", err instanceof Error ? err.message : err);
  process.exit(1);
});
