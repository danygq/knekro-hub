// src/pages/api/auth/signin.ts
import { createDbClient } from "../../../lib/db-client";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const dbClient = createDbClient(request, cookies);

  const { data, error } = await dbClient.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  });

  if (error) return new Response(error.message, { status: 500 });
  return redirect(data.url);
};
