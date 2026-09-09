// src/pages/api/auth/signin.ts
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  });

  if (error) return new Response(error.message, { status: 500 });
  return redirect(data.url);
};
