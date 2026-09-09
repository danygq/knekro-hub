// Server-side helpers + data loader for the games library (/games).
// Import this from an .astro frontmatter (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityAverage,
  GameListRow,
  GameStatus,
  GameStatusRefOrList,
  GameStatusWithCount,
  UserVote,
} from "../types";

/** Normalize an embedded-status value into an array of refs. */
export function statusRefs(status: GameStatusRefOrList | undefined): GameStatus[] {
  if (!status) return [];
  return Array.isArray(status) ? status : [status];
}

/** First status name, used for the badge on a card. */
export function statusName(status: GameStatusRefOrList | undefined): string {
  return statusRefs(status)[0]?.name ?? "";
}

/** Space-separated status ids, matching the `data-status-ids` card attribute. */
export function statusIdString(status: GameStatusRefOrList | undefined): string {
  return statusRefs(status)
    .map((ref) => String(ref.id))
    .join(" ");
}

/** Count games per status id, deduping per game (a game can hold several statuses). */
export function buildStatusCounts(games: GameListRow[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const game of games) {
    const seen = new Set<number>();
    for (const ref of statusRefs(game.status)) {
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      counts.set(ref.id, (counts.get(ref.id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Merge status rows with per-status game counts for the filter panel. */
export function buildGameStatuses(statuses: GameStatus[], games: GameListRow[]): GameStatusWithCount[] {
  const counts = buildStatusCounts(games);
  return statuses.map((status) => ({
    id: status.id,
    name: status.name,
    count: counts.get(status.id) ?? 0,
  }));
}

/**
 * Fetch the status list + games grid in one go. Column-scoped, joined, and
 * bounded per docs/QUERY_OPTIMIZATION.md. Always resolves to arrays so the
 * page renders even while Supabase credentials are still provisioning.
 */
export async function loadGamesLibrary(
  client: SupabaseClient,
): Promise<{ statuses: GameStatus[]; games: GameListRow[] }> {
  const [{ data: statusesData, error: statusesError }, { data: gamesData, error: gamesError }] = await Promise.all([
    client.from("game_status").select("id, name").order("id", { ascending: true }).limit(24),
    client
      .from("games")
      .select("id, name, cover_url, status:game_status!game_status_id(id, name)")
      .order("id", { ascending: true })
      .limit(48),
  ]);

  if (statusesError) {
    console.error("Error fetching statuses:", statusesError);
  }
  if (gamesError) {
    console.error("Error fetching games:", gamesError);
  }

  return {
    statuses: (statusesData as GameStatus[] | null) ?? [],
    games: (gamesData as GameListRow[] | null) ?? [],
  };
}

/**
 * Community average score per game, computed from every non-null vote in
 * `games_user_votes`. Column-scoped and bounded to the passed game ids so it
 * only reads what the grid renders. Returns a map of game_id -> { avg, count }
 * (only games with at least one vote appear).
 */
export async function loadCommunityAverages(
  client: SupabaseClient,
  gameIds: number[],
): Promise<Map<number, CommunityAverage>> {
  const result = new Map<number, CommunityAverage>();
  if (gameIds.length === 0) return result;

  const { data, error } = await client
    .from("games_user_votes")
    .select("game_id, vote")
    .in("game_id", gameIds)
    .not("vote", "is", null);

  if (error) {
    console.error("Error fetching community votes:", error);
    return result;
  }

  const sums = new Map<number, { sum: number; count: number }>();
  for (const row of (data as { game_id: number; vote: number }[] | null) ?? []) {
    const entry = sums.get(row.game_id) ?? { sum: 0, count: 0 };
    entry.sum += row.vote;
    entry.count += 1;
    sums.set(row.game_id, entry);
  }

  for (const [gameId, { sum, count }] of sums) {
    result.set(gameId, { avg: sum / count, count });
  }
  return result;
}

/**
 * The signed-in user's own votes for the passed game ids. Column-scoped and
 * bounded. Returns a map of game_id -> UserVote; a null `vote` means the user
 * cleared their vote (row may still exist) and is treated as "not voted".
 */
export async function loadUserVotes(
  client: SupabaseClient,
  userId: string,
  gameIds: number[],
): Promise<Map<number, UserVote>> {
  const result = new Map<number, UserVote>();
  if (gameIds.length === 0) return result;

  const { data, error } = await client
    .from("games_user_votes")
    .select("id, game_id, vote")
    .eq("user_id", userId)
    .in("game_id", gameIds);

  if (error) {
    console.error("Error fetching user votes:", error);
    return result;
  }

  for (const row of (data as UserVote[] | null) ?? []) {
    result.set(row.game_id, row);
  }
  return result;
}
