import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.signOut();
  return redirect("/");
};
