// src/pages/api/games/search.ts
// Server-side, paginated, name search for the games library.
//
// Reads stay server-side (see docs/modules/data-layer.md): this route uses
// the per-request SSR client so every call carries the user's JWT and respects
// RLS. The browser sends its auth cookies same-origin, so no client ever holds
// the service-role key.
//
// Query is case-insensitive via Postgres `ilike`. Accent-insensitive matching
// ("pokemon" -> "Pokémon") needs the `unaccent` extension + a functional index
// — flagged as a follow-up; this is case-insensitive only.

import { createDbClient } from "../../../lib/db-client";
import type { APIRoute } from "astro";
import type { GameListRow } from "../../../types";

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const dbClient = createDbClient(request, cookies);

  const q = (url.searchParams.get("q") ?? "").trim();
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(
    48,
    Math.max(1, Number(url.searchParams.get("limit") ?? "24")),
  );

  let query = dbClient
    .from("games")
    .select(
      "id, name, cover_url, vote_count, avg_vote, status:game_status!game_status_id(id, name)",
      { count: "exact" },
    )
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q !== "") {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error searching games:", error);
    return new Response(JSON.stringify({ games: [], count: 0 }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      games: (data as GameListRow[] | null) ?? [],
      count: count ?? 0,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
