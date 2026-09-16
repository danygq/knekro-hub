import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import RankingPodium from "@/components/ranking/RankingPodium.astro";
import {
  assignPodiumGame,
  loadPodiumGames,
  removePodiumGame,
} from "@/lib/ranking";
import { userHasRole } from "@/lib/roles";

let containerPromise: Promise<AstroContainer> | null = null;
function getContainer(): Promise<AstroContainer> {
  if (!containerPromise) {
    containerPromise = AstroContainer.create();
  }
  return containerPromise;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const dbClient = locals.supabase;
  const user = locals.user;

  // Strict Owner authorization
  if (!user || !(await userHasRole(dbClient, user.id, "owner"))) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Cuerpo de solicitud inválido" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { action, categoryId, gameId, rank, year = 2026 } = body;

  if (!categoryId || !rank) {
    return new Response(
      JSON.stringify({
        error: "Faltan parámetros obligatorios (categoryId, rank)",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (action === "remove") {
    const result = await removePodiumGame(dbClient, {
      categoryId: Number(categoryId),
      rank: Number(rank),
      year: Number(year),
      userId: user.id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    if (!gameId) {
      return new Response(
        JSON.stringify({ error: "Falta el ID del juego (gameId)" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await assignPodiumGame(dbClient, {
      categoryId: Number(categoryId),
      gameId: Number(gameId),
      rank: Number(rank),
      year: Number(year),
      userId: user.id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Fetch updated podium state for this user to return
  const updatedPodium = await loadPodiumGames(
    dbClient,
    Number(categoryId),
    Number(year),
    user.id,
  );

  const acceptsJson = request.headers
    .get("Accept")
    ?.includes("application/json");

  if (acceptsJson) {
    return new Response(
      JSON.stringify({ success: true, podiumItems: updatedPodium }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Render RankingPodium Astro component directly to eliminate duplicated HTML
  const container = await getContainer();
  const html = await container.renderToString(RankingPodium, {
    props: {
      categoryId: Number(categoryId),
      year: Number(year),
      podiumItems: updatedPodium,
    },
  });

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
