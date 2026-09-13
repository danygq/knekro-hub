import { createSupabaseServerClient } from "../../lib/createSupabaseServerClient";
import { type APIRoute } from "astro";

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const cookieNext = cookies.get("sb-auth-next")?.value;
  cookies.delete("sb-auth-next", { path: "/" });

  const next = cookieNext ?? url.searchParams.get("next") ?? "/";

  if (!code) {
    // No code → likely a misconfiguration; redirect to error
    return redirect("/auth/auth-code-error");
  }

  const supabase = createSupabaseServerClient(request, cookies);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Log the error to see what went wrong
    console.error("Auth exchange error:", error.message);
    return redirect("/auth/auth-code-error");
  }

  const safeNext =
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    !next.startsWith("/auth/session-expired")
      ? next
      : "/";

  return redirect(safeNext);
};
