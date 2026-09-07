// Server-side helpers + data loader for the games library (/games).
// Import this from an .astro frontmatter (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameListRow, GameStatus, GameStatusRefOrList, GameStatusWithCount } from "../types";

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
