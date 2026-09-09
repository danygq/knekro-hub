import { createDbClient } from "../../lib/db-client";
import { type APIRoute } from "astro";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  if (!code) {
    // No code → likely a misconfiguration; redirect to error
    return redirect("/auth/auth-code-error");
  }

  const dbClient = createDbClient(request, cookies);

  const { error } = await dbClient.auth.exchangeCodeForSession(code);

  if (error) {
    // Log the error to see what went wrong
    console.error("Auth exchange error:", error.message);
    return redirect("/auth/auth-code-error");
  }

  return redirect(next);
};
