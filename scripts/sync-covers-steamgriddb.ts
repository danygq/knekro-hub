/**
 * CLI utility to retroactively populate cover_url for games in the database
 * using the SteamGridDB API v2.
 *
 * For each game with cover_url = null (or all games when --force is passed),
 * performs a two-step SteamGridDB lookup:
 *   1. GET /api/v2/search/autocomplete/{name} → resolves SGDB game ID
 *   2. GET /api/v2/grids/game/{sgdbId}?dimensions=600x900 → picks first url
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

// ── Helpers ────────────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
SteamGridDB Cover Sync Script

For each game in the database that is missing cover_url (or all games with --force),
fetches the best 600×900 grid image from SteamGridDB and writes the URL back to cover_url.

Usage:
  node scripts/sync-covers-steamgriddb.ts [options]

Options:
  -d, --dry-run      Simulate without writing to the database
  -f, --force        Process all games, even those with an existing cover_url
  -l, --limit <n>    Process only the first N games
      --delay <ms>   Delay in ms between API calls (default: 300)
  -h, --help         Show this help message

Environment:
  STEAMGRIDDB_API_KEY  Required. Set in .env.local or Vercel env vars.

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

// ── Main ────────────────────────────────────────────────────────────────────────────

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

  // ── Validate env ───────────────────────────────────────────────────────────────
  const apiKey = process.env.STEAMGRIDDB_API_KEY;
  if (!apiKey) {
    console.error(
      "[Error] STEAMGRIDDB_API_KEY is not set. Add it to .env.local or set it in your environment.",
    );
    process.exit(1);
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

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SteamGridDB Cover Sync");
  console.log(`  Mode     : ${isDryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`  Scope    : ${isForce ? "ALL games" : "games with cover_url = null"}`);
  console.log(`  Delay    : ${delayMs}ms between API calls`);
  if (limitCount !== undefined) {
    console.log(`  Limit    : first ${limitCount} games`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Supabase setup ──────────────────────────────────────────────────────────────
  const { createSupabaseAdminClient } = await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  // ── Import SteamGridDB helper ───────────────────────────────────────────────────────
  const { fetchSgdbCover } = await import("../src/lib/steamgriddb.ts");

  // ── Fetch target games ─────────────────────────────────────────────────────────────
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

  // ── Counters ───────────────────────────────────────────────────────────────────────
  const startTime = Date.now();
  let updatedCount = 0;
  let skippedCount = 0; // no SGDB match
  let alreadySetCount = 0; // cover_url already identical
  let errorCount = 0;

  // ── Process each game ─────────────────────────────────────────────────────────────
  for (const game of games) {
    const coverUrl = await fetchSgdbCover(game.name ?? "");

    if (!coverUrl) {
      console.log(`[SYNC] ${game.id} | ${game.name} → null (no SGDB match)`);
      skippedCount++;
    } else if (coverUrl === game.cover_url) {
      console.log(`[SYNC] ${game.id} | ${game.name} → already set, skipping`);
      alreadySetCount++;
    } else if (isDryRun) {
      console.log(`[DRY-RUN] ${game.id} | ${game.name} → ${coverUrl}`);
      updatedCount++;
    } else {
      const { error: updateError } = await supabase
        .from("games")
        .update({ cover_url: coverUrl })
        .eq("id", game.id);

      if (updateError) {
        console.error(
          `[ERROR] ${game.id} | ${game.name} — update failed: ${updateError.message}`,
        );
        errorCount++;
      } else {
        console.log(`[SYNC] ${game.id} | ${game.name} → ${coverUrl}`);
        updatedCount++;
      }
    }

    await sleep(delayMs);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────────
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sync Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Mode       : ${isDryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`  Evaluated  : ${games.length}`);
  console.log(`  Updated    : ${updatedCount}${isDryRun ? " (simulated)" : ""}`);
  console.log(`  Skipped    : ${skippedCount} (no SGDB match)`);
  console.log(`  Already OK : ${alreadySetCount}`);
  console.log(`  Errors     : ${errorCount}`);
  console.log(`  Duration   : ${durationSec}s`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n[Fatal Error]", err instanceof Error ? err.message : err);
  process.exit(1);
});
