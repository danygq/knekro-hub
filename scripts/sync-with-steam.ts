/**
 * CLI utility to sync Steam data (Steam App ID and user tags) for games in the database.
 * Uses the lightweight native HTTP fetch approach (Steam Store Search API + store page tags).
 *
 * Usage:
 *   node scripts/sync-with-steam.ts [options]
 *   node scripts/sync-with-steam.ts --missing
 *   node scripts/sync-with-steam.ts --game "The Binding of Isaac"
 *   node scripts/sync-with-steam.ts --force
 *   node scripts/sync-with-steam.ts --dry-run
 *   node scripts/sync-with-steam.ts --delay 500
 *   node scripts/sync-with-steam.ts --help
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
Game Steam Sync Script (App ID & Spanish Tags)

For games in the database, searches Steam and syncs Steam App ID and user tags:
  1. Searches Steam Store API for the best match (similarity >= 85%).
  2. Saves discovered Steam App ID to public.games.steam_game_id.
  3. Upserts any newly discovered tags into public.tags (deduplicating via unique name).
  4. Links game to tags in public.games_tags.

Usage:
  node scripts/sync-with-steam.ts [options]

Options:
  -m, --missing      Process only games missing steam_game_id or tags (default if no other mode specified)
  -f, --force        Process all games, even those with existing Steam ID / tags
  -g, --game <name>  Process a single game matching the given name (case-insensitive substring)
  -d, --dry-run      Simulate without writing to the database
  -l, --limit <n>    Process only the first N games
      --delay <ms>   Delay in ms between Steam requests (default: 300)
  -h, --help         Show this help message

Examples:
  node scripts/sync-with-steam.ts --help
  node scripts/sync-with-steam.ts --missing
  node scripts/sync-with-steam.ts --game "Dungeonbound"
  node scripts/sync-with-steam.ts --force --dry-run
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let opts: {
    missing: boolean;
    force: boolean;
    game?: string;
    "dry-run": boolean;
    limit?: string;
    delay?: string;
    help: boolean;
  };

  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        missing: { type: "boolean", short: "m", default: false },
        force: { type: "boolean", short: "f", default: false },
        game: { type: "string", short: "g" },
        "dry-run": { type: "boolean", short: "d", default: false },
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

  const isDryRun = opts["dry-run"] ?? false;
  const isForce = opts.force ?? false;
  const specificGame = opts.game?.trim();
  const isMissingOnly = opts.missing || (!isForce && !specificGame);
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
  console.log("  Game Steam Sync (App ID + Tags)");
  console.log(
    `  Mode     : ${isDryRun ? "DRY-RUN (no database writes)" : "LIVE"}`,
  );
  console.log(
    `  Scope    : ${
      specificGame
        ? `Single game matching "${specificGame}"`
        : isForce
          ? "ALL games"
          : "Games missing steam_game_id or tags"
    }`,
  );
  console.log(`  Delay    : ${delayMs}ms between Steam API calls`);
  if (limitCount !== undefined) {
    console.log(`  Limit    : first ${limitCount} games`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Supabase & Steam Module ─────────────────────────────────────────────────
  const { createSupabaseAdminClient } =
    await import("../src/lib/supabase-admin.ts");
  const supabase = createSupabaseAdminClient();

  const { fetchSteamTags, syncGameTags } =
    await import("../src/lib/steam-tags.ts");

  // ── Fetch Target Games ──────────────────────────────────────────────────────
  console.log("\n[DB] Fetching target games...");

  let targetGames: Array<{ id: number; name: string }> = [];

  if (specificGame) {
    const { data, error } = await supabase
      .from("games")
      .select("id, name")
      .ilike("name", `%${specificGame}%`)
      .order("name", { ascending: true });

    if (error) {
      console.error("[DB] Error fetching game by name:", error);
      process.exit(1);
    }
    targetGames = (data || []).map((g) => ({ id: g.id, name: g.name ?? "" }));
  } else if (isMissingOnly) {
    // Select games that have steam_game_id IS NULL OR 0 entries in games_tags
    const { data: gamesWithTagEmbed, error: gamesError } = await supabase
      .from("games")
      .select("id, name, steam_game_id, games_tags(tag_id)")
      .order("name", { ascending: true });

    if (gamesError) {
      console.error("[DB] Error fetching games for missing sync:", gamesError);
      process.exit(1);
    }

    targetGames = (gamesWithTagEmbed || [])
      .filter(
        (g) => !g.steam_game_id || !g.games_tags || g.games_tags.length === 0,
      )
      .map((g) => ({ id: g.id, name: g.name ?? "" }));
  } else {
    // isForce = true
    const { data, error } = await supabase
      .from("games")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("[DB] Error fetching all games:", error);
      process.exit(1);
    }
    targetGames = (data || []).map((g) => ({ id: g.id, name: g.name ?? "" }));
  }

  if (limitCount !== undefined) {
    targetGames = targetGames.slice(0, limitCount);
  }

  console.log(`[DB] Found ${targetGames.length} game(s) to process.\n`);

  if (targetGames.length === 0) {
    console.log("No games to process. All done!");
    process.exit(0);
  }

  // ── Process Games ───────────────────────────────────────────────────────────
  let matchedCount = 0;
  let skippedCount = 0;
  let totalTagsLinked = 0;

  for (let i = 0; i < targetGames.length; i++) {
    const game = targetGames[i];
    const prefix = `[${i + 1}/${targetGames.length}] "${game.name}" (id: ${game.id})`;

    if (isDryRun) {
      const result = await fetchSteamTags(game.name);
      if (result.tags.length > 0 && result.steamAppId) {
        matchedCount++;
        totalTagsLinked += result.tags.length;
        console.log(
          `  ✅ ${prefix} => Match: "${result.steamAppName}" (Steam ID: ${result.steamAppId}, ${((result.similarity ?? 1) * 100).toFixed(1)}%) — ${result.tags.length} tags (dry-run)`,
        );
      } else if (result.steamAppName) {
        skippedCount++;
        console.log(
          `  ⚠️ ${prefix} => Steam candidate "${result.steamAppName}" rejected (${((result.similarity ?? 0) * 100).toFixed(1)}% similarity < 85%)`,
        );
      } else {
        skippedCount++;
        console.log(`  ❌ ${prefix} => No results on Steam Store`);
      }
    } else {
      const result = await syncGameTags(supabase, game.id, game.name);
      if (result.steamAppId) {
        matchedCount++;
        totalTagsLinked += result.addedRelations;
        console.log(
          `  ✅ ${prefix} => Match: "${result.steamAppName}" (Steam ID: ${result.steamAppId}, ${((result.similarity ?? 1) * 100).toFixed(1)}%) — Synced ${result.tags.length} tags (${result.addedRelations} linked)`,
        );
      } else if (result.steamAppName) {
        skippedCount++;
        console.log(
          `  ⚠️ ${prefix} => Steam candidate "${result.steamAppName}" rejected (${((result.similarity ?? 0) * 100).toFixed(1)}% similarity < 85%)`,
        );
      } else {
        skippedCount++;
        console.log(`  ❌ ${prefix} => No results on Steam Store`);
      }
    }

    if (i < targetGames.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sync Summary");
  console.log(`  Processed games : ${targetGames.length}`);
  console.log(`  Matched on Steam: ${matchedCount}`);
  console.log(`  Unmatched/Skipped: ${skippedCount}`);
  console.log(`  Total tags linked: ${totalTagsLinked}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("Fatal error in sync-with-steam:", err);
  process.exit(1);
});
