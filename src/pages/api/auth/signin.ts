// src/pages/api/auth/signin.ts
import { createSupabaseServerClient } from "@/lib/createSupabaseServerClient";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  let next = "/";
  try {
    const contentType = request.headers.get("content-type") || "";
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const formNext = formData.get("next");
      if (typeof formNext === "string") {
        next = formNext;
      }
    }
  } catch {
    // Fallback if formData parsing fails
  }

  if (next === "/") {
    const urlNext = new URL(request.url).searchParams.get("next");
    if (urlNext) {
      next = urlNext;
    }
  }

  // Prevent open redirects and loops
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.startsWith("/auth/session-expired")
  ) {
    next = "/";
  }

  // Preserve the next route in a short-lived cookie.
  // This keeps the OAuth redirectTo URL clean and strictly matches the
  // exact allowed callback URLs registered in Supabase (avoiding query string mismatch).
  if (next !== "/") {
    cookies.set("sb-auth-next", next, {
      path: "/",
      maxAge: 60 * 5, // 5 minutes
      httpOnly: true,
      sameSite: "lax",
      secure: import.meta.env.PROD,
    });
  } else {
    cookies.delete("sb-auth-next", { path: "/" });
  }

  const callbackUrl = `${new URL(request.url).origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error) return new Response(error.message, { status: 500 });
  return redirect(data.url);
};
