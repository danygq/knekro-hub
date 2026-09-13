import { defineMiddleware } from "astro:middleware";
import {
  createSupabaseServerClient,
  isSessionExpiredError,
} from "./lib/createSupabaseServerClient";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context.request, context.cookies);
  context.locals.supabase = supabase;

  const pathname = context.url.pathname;

  // Skip user session check for webhooks and auth flow endpoints
  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth/")
  ) {
    context.locals.user = null;
    return next();
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isSessionExpiredError(error)) {
      await supabase.auth.signOut({ scope: "local" });
    }
    context.locals.user = null;
  } else {
    context.locals.user = data.user;
  }

  return next();
});
