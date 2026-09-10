import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Create a per-request database client for Astro SSR.
 *
 * IMPORTANT: this must be called in page frontmatter (not in layouts or
 * imported components). Astro.cookies.set() only works before the response
 * headers are sent — layouts/components run too late and throw
 * ResponseSentError when the auth token is refreshed.
 *
 * Use this single client for both auth and data queries so that every
 * request carries the user's JWT and respects Row Level Security policies.
 *
 * @param request - Astro.request (pages) or the `request` param (API routes)
 * @param cookieStore - Astro.cookies (pages) or the `cookies` param (API routes)
 */
export function createDbClient(
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

/**
 * Browser-side Supabase client for direct DB operations from client <script>
 * blocks. Uses the publishable key — safe for the browser when RLS policies
 * are in place.
 *
 * For writes, the caller must first sync the SSR auth session via
 * `supabaseClient.auth.setSession(session)` so the user's JWT is attached
 * and RLS policies apply.
 */
export const supabaseClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key",
);
