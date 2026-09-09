import { createDbClient } from "../../../lib/db-client";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const dbClient = createDbClient(request, cookies);

  await dbClient.auth.signOut();
  return redirect("/");
};
