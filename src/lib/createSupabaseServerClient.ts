import { createServerClient, parseCookieHeader } from "@supabase/ssr";

export type CookieStore = {
  set: (name: string, value: string, options?: any) => void;
  delete?: (name: string, options?: any) => void;
  get?: (name: string) => any;
};

/**
 * Creates a per-request Supabase server client for Astro SSR.
 *
 * @param request - Astro.request (pages/layouts) or request parameter (API routes)
 * @param cookieStore - Astro.cookies (pages/layouts) or cookies parameter (API routes)
 */
export function createSupabaseServerClient(
  request: Request,
  cookieStore: CookieStore,
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called after response headers were already sent.
            // Catching this prevents Astro from crashing with ResponseSentError.
          }
        },
      },
    },
  );
}

/**
 * Checks whether an auth error indicates an expired, invalid, or revoked session.
 * Explicitly distinguishes between unauthenticated/missing sessions and network/server failures.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // Unauthenticated with no session is normal, not expired
  if ("name" in error && error.name === "AuthSessionMissingError") {
    return false;
  }

  // Network retryable fetch errors are transient network failures
  if ("name" in error && error.name === "AuthRetryableFetchError") {
    return false;
  }

  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };

  // 5xx status codes indicate server / infrastructure issues, not expired user session
  if (typeof err.status === "number" && err.status >= 500) {
    return false;
  }

  const code = (err.code || "").toLowerCase();
  const message = (err.message || "").toLowerCase();

  const expiredCodes = [
    "session_expired",
    "session_not_found",
    "bad_jwt",
    "refresh_token_not_found",
    "refresh_token_already_used",
    "flow_state_expired",
    "flow_state_not_found",
    "invalid_grant",
    "invalid_token",
  ];

  if (expiredCodes.includes(code)) {
    return true;
  }

  if (
    message.includes("expired") ||
    message.includes("refresh token") ||
    message.includes("bad jwt") ||
    message.includes("invalid token") ||
    message.includes("session not found") ||
    message.includes("invalid refresh token")
  ) {
    return true;
  }

  // 401 Unauthorized or 403 Forbidden with auth token
  if (err.status === 401 || err.status === 403) {
    return true;
  }

  return false;
}
