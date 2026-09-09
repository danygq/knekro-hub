import { createServerClient, parseCookieHeader } from "@supabase/ssr";

/**
 * Create a Supabase server client for Astro SSR.
 *
 * IMPORTANT: this must be called in page frontmatter (not in layouts or
 * imported components). Astro.cookies.set() only works before the response
 * headers are sent — layouts/components run too late and throw
 * ResponseSentError when Supabase refreshes the auth token.
 *
 * @param request - Astro.request (pages) or the `request` param (API routes)
 * @param cookieStore - Astro.cookies (pages) or the `cookies` param (API routes)
 */
export function createSupabaseServerClient(
  request: Request,
  cookieStore: { set: (name: string, value: string, options?: any) => void },
) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
