import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  site: "https://knekro.vercel.app/",

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [alpinejs()],
});
