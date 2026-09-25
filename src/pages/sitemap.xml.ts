import type { APIRoute } from "astro";

function formatLastmod(val?: string | null): string | null {
  if (!val) return null;
  const normalized = val.includes("T") ? val : val.replace(" ", "T");
  const date = new Date(
    normalized.endsWith("Z") ? normalized : `${normalized}Z`,
  );
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export const GET: APIRoute = async ({ locals, site, url }) => {
  const dbClient = locals.supabase;
  const baseUrl = (site ? site.toString() : url.origin).replace(/\/$/, "");

  // Static public routes
  const staticRoutes = [
    { path: "", changefreq: "daily", priority: "1.0" },
    { path: "/games", changefreq: "daily", priority: "0.9" },
    { path: "/streams", changefreq: "daily", priority: "0.8" },
  ];

  let games: {
    id: number;
    last_played_at: string | null;
    created_at: string | null;
  }[] = [];
  let streams: {
    id: number;
    started_at: string | null;
    created_at: string | null;
  }[] = [];

  try {
    const [gamesRes, streamsRes] = await Promise.all([
      dbClient
        .from("games")
        .select("id, last_played_at, created_at")
        .order("id", { ascending: false }),
      dbClient
        .from("streams")
        .select("id, started_at, created_at")
        .order("started_at", { ascending: false }),
    ]);

    if (gamesRes.data) {
      games = gamesRes.data as typeof games;
    }
    if (streamsRes.data) {
      streams = streamsRes.data as typeof streams;
    }
  } catch (err) {
    console.error("Error generating dynamic sitemap entries:", err);
  }

  const urls: string[] = [];

  for (const route of staticRoutes) {
    urls.push(`  <url>
    <loc>${baseUrl}${route.path}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`);
  }

  for (const game of games) {
    const lastmod = formatLastmod(game.last_played_at || game.created_at);
    urls.push(`  <url>
    <loc>${baseUrl}/games/${game.id}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  for (const stream of streams) {
    const lastmod = formatLastmod(stream.started_at || stream.created_at);
    urls.push(`  <url>
    <loc>${baseUrl}/streams/${stream.id}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemapXml.trim(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=14400, stale-while-revalidate=86400",
    },
  });
};
