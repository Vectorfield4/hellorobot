import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://hellorobot.ru",
  trailingSlash: "never",
  integrations: [react(), sitemap()],
  i18n: {
    defaultLocale: "ru",
    locales: ["ru"],
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
