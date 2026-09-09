// Server-side vote handler for the games library. Uses the per-request SSR
// cookie client (createDbClient) so the caller is authenticated; the user_id
// always comes from the session, never from the request body. POST { game_id, vote }
// where `vote` is a number 1-10 to set/update, or null to clear (row is kept,
// vote column zeroed).
import { createDbClient } from "../../../lib/db-client";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies }) => {
  const dbClient = createDbClient(request, cookies);

  const {
    data: { user },
  } = await dbClient.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  let body: { game_id?: unknown; vote?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo inválido" }), { status: 400 });
  }

  const gameId = Number(body.game_id);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return new Response(JSON.stringify({ error: "game_id inválido" }), { status: 400 });
  }

  // Clearing a vote: `vote` is explicitly null. Keep the row, zero the column.
  const clearing = body.vote === null;
  const vote = Number(body.vote);
  if (!clearing && (!Number.isInteger(vote) || vote < 1 || vote > 10)) {
    return new Response(JSON.stringify({ error: "vote debe ser un número entre 1 y 10, o null" }), { status: 400 });
  }

  // Look for an existing row for this (user, game) so we update in place rather
  // than stack duplicate rows.
  const { data: existing, error: findError } = await dbClient
    .from("games_user_votes")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (findError) {
    return new Response(JSON.stringify({ error: findError.message }), { status: 500 });
  }

  if (existing?.id != null) {
    const { error } = await dbClient
      .from("games_user_votes")
      .update({ vote: clearing ? null : vote })
      .eq("id", existing.id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  } else if (!clearing) {
    const { error } = await dbClient.from("games_user_votes").insert({ user_id: user.id, game_id: gameId, vote });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ ok: true, game_id: gameId, vote: clearing ? null : vote }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
