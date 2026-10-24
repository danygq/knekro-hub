import type { APIRoute } from "astro";
import { userHasAnyRole } from "@/lib/roles";
import { updateGameSteamIdAndTags } from "@/lib/steam-tags";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const dbClient = locals.supabase;
  const user = locals.user;

  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "HX-Redirect": "/auth/session-expired" },
    });
  }

  const canEdit = await userHasAnyRole(dbClient, user.id, ["owner", "manager"]);
  if (!canEdit) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const gameIdRaw = form.get("game_id");
  const gameId = Number(gameIdRaw);

  if (!gameIdRaw || !Number.isInteger(gameId) || gameId <= 0) {
    return new Response("ID de juego inválido", { status: 400 });
  }

  const rawSteamId = form.get("steam_id");
  let steamAppId: number | null = null;

  if (rawSteamId !== null && rawSteamId !== undefined) {
    const trimmed = String(rawSteamId).trim();
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return new Response("ID de Steam inválido", { status: 400 });
      }
      steamAppId = parsed;
    }
  }

  const adminClient = createSupabaseAdminClient();
  const result = await updateGameSteamIdAndTags(
    adminClient,
    gameId,
    steamAppId,
  );

  if (!result.success) {
    return new Response(result.error || "Error al actualizar Steam ID", {
      status: 500,
    });
  }

  if (request.headers.get("HX-Request")) {
    return new Response(null, {
      status: 200,
      headers: { "HX-Refresh": "true" },
    });
  }

  return redirect(`/games/${gameId}`);
};
