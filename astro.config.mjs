import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  site: "https://knekro.vercel.app/",
  redirects: {
    "/rankings": "/ranking",
    "/rankings/[...slug]": "/ranking/[...slug]",
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [alpinejs()],
});
