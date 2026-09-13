import { createSupabaseServerClient } from "@/lib/createSupabaseServerClient";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  await supabase.auth.signOut();
  return redirect("/");
};
