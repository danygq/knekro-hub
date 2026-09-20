import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalizes a game title for fuzzy comparison:
 * - lowercase
 * - strips punctuation (: - — ' etc.)
 * - normalizes Roman numerals (II -> 2, III -> 3, etc.)
 * - removes all remaining whitespace for condensed matching
 */
export function normalizeTitle(s: string): string {
  let norm = s
    .toLowerCase()
    .replace(/[:\-–—'’!?™®()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const romanMap: Record<string, string> = {
    " ii": " 2",
    " iii": " 3",
    " iv": " 4",
    " v": " 5",
  };
  for (const [rom, num] of Object.entries(romanMap)) {
    norm = norm.replace(new RegExp(`${rom}$`, "g"), num);
    norm = norm.replace(new RegExp(`${rom} `, "g"), `${num} `);
  }

  return norm.replace(/\s+/g, "");
}

/**
 * Calculates similarity between two strings (0.0 to 1.0) using Levenshtein distance on normalized titles.
 */
export function getTitleSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeTitle(s1);
  const norm2 = normalizeTitle(s2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  // If one contains the other, check length ratio
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const ratio =
      Math.min(norm1.length, norm2.length) /
      Math.max(norm1.length, norm2.length);
    if (ratio >= 0.85) return ratio;
  }

  const track = Array(norm2.length + 1)
    .fill(null)
    .map(() => Array(norm1.length + 1).fill(null));

  for (let i = 0; i <= norm1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= norm2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= norm2.length; j += 1) {
    for (let i = 1; i <= norm1.length; i += 1) {
      const indicator = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator,
      );
    }
  }

  const distance = track[norm2.length][norm1.length];
  const maxLength = Math.max(norm1.length, norm2.length);
  return Math.max(0, 1 - distance / maxLength);
}

export interface SteamFetchResult {
  tags: string[];
  steamAppId?: number;
  steamAppName?: string;
  similarity?: number;
}

/**
 * Searches Steam for a game title and retrieves its user tags in Spanish via standard HTTP fetch.
 * Does not require Puppeteer or a browser binary.
 */
export async function fetchSteamTags(
  gameTitle: string,
  minSimilarity = 0.85,
): Promise<SteamFetchResult> {
  const trimmed = gameTitle.trim();
  if (!trimmed) return { tags: [] };

  try {
    // 1. Search Steam Store API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(trimmed)}&l=spanish&cc=es`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!searchRes.ok) {
      console.warn(
        `[Steam Tags] Search failed for "${trimmed}" with status ${searchRes.status}`,
      );
      return { tags: [] };
    }

    const searchData = (await searchRes.json()) as {
      items?: Array<{ id: number; name: string }>;
    };

    if (!searchData.items || searchData.items.length === 0) {
      return { tags: [] };
    }

    // Pick best match among returned items
    let bestItem: { id: number; name: string } | null = null;
    let bestScore = 0;

    for (const item of searchData.items) {
      const score = getTitleSimilarity(trimmed, item.name);
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }

    if (!bestItem || bestScore < minSimilarity) {
      return {
        tags: [],
        steamAppName: bestItem?.name,
        similarity: bestScore,
      };
    }

    // 2. Fetch game store page HTML directly with Spanish and adult content cookies
    const pageUrl = `https://store.steampowered.com/app/${bestItem.id}/`;
    const pageRes = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        Cookie:
          "Steam_Language=spanish; birthtime=568022401; wants_mature_content=1",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!pageRes.ok) {
      console.warn(
        `[Steam Tags] Store page fetch failed for "${bestItem.name}" (app ${bestItem.id}) with status ${pageRes.status}`,
      );
      return {
        tags: [],
        steamAppId: bestItem.id,
        steamAppName: bestItem.name,
        similarity: bestScore,
      };
    }

    const html = await pageRes.text();

    // Extract tags from glance_tags / app_tag links
    const tagRegex = /<a[^>]*class="[^"]*app_tag[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const tagsSet = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(html)) !== null) {
      const tag = match[1].trim();
      if (tag && tag !== "+") {
        tagsSet.add(tag);
      }
    }

    const tags = Array.from(tagsSet);

    return {
      tags,
      steamAppId: bestItem.id,
      steamAppName: bestItem.name,
      similarity: bestScore,
    };
  } catch (error) {
    console.error(
      `[Steam Tags] Error fetching tags for "${trimmed}":`,
      error instanceof Error ? error.message : String(error),
    );
    return { tags: [] };
  }
}

export interface SyncGameTagsResult {
  tags: string[];
  steamAppId?: number;
  steamAppName?: string;
  similarity?: number;
  addedRelations: number;
}

/**
 * Synchronizes Steam tags for a game with Supabase:
 * 1. Fetches tags from Steam Store API & page.
 * 2. Upserts any newly discovered tags into `public.tags` (name is UNIQUE).
 * 3. Links the game to the tags in `public.games_tags`.
 */
export async function syncGameTags(
  supabaseAdmin: SupabaseClient,
  gameId: number,
  gameName: string,
  minSimilarity = 0.85,
): Promise<SyncGameTagsResult> {
  const fetchResult = await fetchSteamTags(gameName, minSimilarity);
  const uniqueTags = Array.from(new Set(fetchResult.tags));

  if (!uniqueTags.length) {
    return {
      tags: [],
      steamAppId: fetchResult.steamAppId,
      steamAppName: fetchResult.steamAppName,
      similarity: fetchResult.similarity,
      addedRelations: 0,
    };
  }

  // 1. Upsert tags into public.tags so any new tags are recorded
  const tagRowsToUpsert = uniqueTags.map((name) => ({ name }));
  const { error: tagsUpsertError } = await supabaseAdmin
    .from("tags")
    .upsert(tagRowsToUpsert, { onConflict: "name" });

  if (tagsUpsertError) {
    console.error(
      `[Steam Tags] Failed to upsert tags into public.tags for "${gameName}":`,
      tagsUpsertError,
    );
  }

  // 2. Select IDs for all tags of this game
  const { data: tagEntities, error: selectError } = await supabaseAdmin
    .from("tags")
    .select("id, name")
    .in("name", uniqueTags);

  if (selectError || !tagEntities?.length) {
    console.error(
      `[Steam Tags] Failed to fetch tag IDs for "${gameName}":`,
      selectError,
    );
    return {
      tags: fetchResult.tags,
      steamAppId: fetchResult.steamAppId,
      steamAppName: fetchResult.steamAppName,
      similarity: fetchResult.similarity,
      addedRelations: 0,
    };
  }

  // 3. Insert junction rows into public.games_tags
  const junctionRows = tagEntities.map((t) => ({
    game_id: gameId,
    tag_id: t.id,
  }));

  const { error: junctionError } = await supabaseAdmin
    .from("games_tags")
    .upsert(junctionRows, { onConflict: "game_id,tag_id" });

  if (junctionError) {
    console.error(
      `[Steam Tags] Failed to upsert relations in games_tags for game ${gameId}:`,
      junctionError,
    );
    return {
      tags: fetchResult.tags,
      steamAppId: fetchResult.steamAppId,
      steamAppName: fetchResult.steamAppName,
      similarity: fetchResult.similarity,
      addedRelations: 0,
    };
  }

  return {
    tags: fetchResult.tags,
    steamAppId: fetchResult.steamAppId,
    steamAppName: fetchResult.steamAppName,
    similarity: fetchResult.similarity,
    addedRelations: junctionRows.length,
  };
}
