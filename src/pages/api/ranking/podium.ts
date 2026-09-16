import type { APIRoute } from "astro";
import {
  assignPodiumGame,
  loadPodiumGames,
  removePodiumGame,
  type RankingGameItem,
} from "@/lib/ranking";
import { userHasRole } from "@/lib/roles";

const rankMetadata: Record<number, { label: string; emoji: string }> = {
  1: { label: "Oro", emoji: "🥇" },
  2: { label: "Plata", emoji: "🥈" },
  3: { label: "Bronce", emoji: "🥉" },
};

function renderPodiumSlotHtml(
  rank: 1 | 2 | 3,
  item: RankingGameItem | null,
  categoryId: number,
  year: number,
): string {
  const meta = rankMetadata[rank];
  const game = item?.game;

  const cardHtml = game
    ? `
    <article
      class="knk-podium-item knk-ranking-card knk-game-card group relative w-full border border-(--knk-line) bg-(--knk-surface) hover:border-(--knk-line-strong) transition-colors select-none cursor-grab active:cursor-grabbing"
      data-game-id="${game.id}"
      data-rank="${rank}"
    >
      <div class="relative bg-(--knk-surface-2) knk-grid-bg overflow-hidden aspect-[2/3]">
        ${
          game.cover_url
            ? `<img src="${game.cover_url}" alt="${game.name}" class="w-full h-full object-cover" loading="lazy" />`
            : `<div class="w-full h-full flex items-center justify-center text-(--knk-text-faint)">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect width="20" height="12" x="2" y="6" rx="2"></rect>
                  <path d="M6 12h4m-2-2v4m7-2h.01m2.99 0h.01"></path>
                </svg>
              </div>`
        }
        ${
          game.status?.name
            ? `<span class="absolute top-3 right-3 z-10 knk-notch-sm px-2.5 py-1 text-xs font-medium bg-(--knk-bg)/80 text-(--knk-text-muted) border border-(--knk-line)">${game.status.name}</span>`
            : ""
        }

        <!-- Hover overlay with medal actions & remove -->
        <div class="knk-card-medal-overlay absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 p-2.5 z-20">
          <span class="text-[10px] font-semibold text-white/90 uppercase tracking-wider text-center">
            Mover a:
          </span>
          <div class="flex flex-wrap items-center justify-center gap-1.5">
            ${
              rank !== 1
                ? `<button
                    type="button"
                    class="knk-notch-sm px-2 py-1 text-xs font-medium border border-amber-400/50 bg-amber-400/20 hover:bg-amber-400/40 text-amber-300 transition-colors cursor-pointer"
                    title="Mover a Oro"
                    onclick="window.handlePodiumDrop(${game.id}, 1, ${categoryId}, ${year})"
                  >🥇 Oro</button>`
                : ""
            }
            ${
              rank !== 2
                ? `<button
                    type="button"
                    class="knk-notch-sm px-2 py-1 text-xs font-medium border border-slate-300/50 bg-slate-300/20 hover:bg-slate-300/40 text-slate-200 transition-colors cursor-pointer"
                    title="Mover a Plata"
                    onclick="window.handlePodiumDrop(${game.id}, 2, ${categoryId}, ${year})"
                  >🥈 Plata</button>`
                : ""
            }
            ${
              rank !== 3
                ? `<button
                    type="button"
                    class="knk-notch-sm px-2 py-1 text-xs font-medium border border-amber-700/50 bg-amber-700/20 hover:bg-amber-700/40 text-amber-500 transition-colors cursor-pointer"
                    title="Mover a Bronce"
                    onclick="window.handlePodiumDrop(${game.id}, 3, ${categoryId}, ${year})"
                  >🥉 Bronce</button>`
                : ""
            }
          </div>
          <button
            type="button"
            class="knk-notch-sm mt-1 px-2.5 py-1 text-xs font-medium border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-300 transition-colors cursor-pointer"
            title="Quitar del podio"
            onclick="window.removePodiumGame(${rank}, ${categoryId}, ${year})"
          >
            ✕ Quitar
          </button>
        </div>
      </div>

      <div class="p-4 max-h-fit overflow-hidden text-ellipsis">
        <h3
          class="font-(--font-display) text-base overflow-hidden text-ellipsis tracking-tight group-hover:text-(--knk-primary) transition-colors text-center"
          title="${game.name}"
        >
          ${game.name}
        </h3>
      </div>
    </article>
  `
    : `
    <div class="knk-podium-empty w-full aspect-[2/3] border-2 border-dashed border-(--knk-line-strong) bg-(--knk-surface-2)/30 flex flex-col items-center justify-center p-6 text-center pointer-events-none select-none">
      <span class="text-4xl mb-3 opacity-50" aria-hidden="true">${meta.emoji}</span>
      <span class="text-sm font-semibold text-white">${meta.label}</span>
      <span class="text-xs text-(--knk-text-muted) mt-1.5 leading-tight">
        Arrastra un juego aquí
      </span>
    </div>
  `;

  return `
    <div class="knk-podium-slot knk-podium-slot-${rank} w-full max-w-[260px]">
      <div class="flex items-center justify-between gap-2 mb-4 w-full">
        <div class="flex items-center gap-2">
          <span class="text-2xl" aria-hidden="true">${meta.emoji}</span>
          <div>
            <span class="text-[10px] font-semibold tracking-wider uppercase text-(--knk-text-muted)">
              Puesto #${rank}
            </span>
            <h4 class="font-(--font-display) text-sm text-white tracking-tight leading-none">
              ${meta.label}
            </h4>
          </div>
        </div>

        ${
          game
            ? `<button
                type="button"
                title="Quitar del podio"
                class="knk-notch-sm text-[11px] px-2 py-0.5 text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-500/50 bg-red-950/30 transition-all cursor-pointer"
                onclick="window.removePodiumGame(${rank}, ${categoryId}, ${year})"
              >Quitar</button>`
            : ""
        }
      </div>

      <div
        class="knk-podium-dropzone w-full"
        data-rank="${rank}"
        data-category-id="${categoryId}"
        data-year="${year}"
      >
        ${cardHtml}
      </div>
    </div>
  `;
}

function renderFullPodiumHtml(
  categoryId: number,
  year: number,
  podiumItems: RankingGameItem[],
): string {
  const gold = podiumItems.find((i) => i.rank === 1) ?? null;
  const silver = podiumItems.find((i) => i.rank === 2) ?? null;
  const bronze = podiumItems.find((i) => i.rank === 3) ?? null;

  return `
    <section id="ranking-podium" class="mb-12">
      <div class="knk-podium-container">
        ${renderPodiumSlotHtml(1, gold, categoryId, year)}
        ${renderPodiumSlotHtml(2, silver, categoryId, year)}
        ${renderPodiumSlotHtml(3, bronze, categoryId, year)}
      </div>
    </section>
  `;
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

  // Return HTML partial for smooth, seamless in-place podium swap without page reload
  const html = renderFullPodiumHtml(
    Number(categoryId),
    Number(year),
    updatedPodium,
  );

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
