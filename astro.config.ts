import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com",
  trailingSlash: "never",
  integrations: [react(), sitemap()],
  i18n: {
    defaultLocale: "ru",
    locales: ["ru", "en"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
  },
});
