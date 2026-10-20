import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import stylex from "@stylexjs/unplugin/vite";
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
    plugins: [
      stylex({
        useCSSLayers: true,
        aliases: {
          "@/*": ["./src/*"],
          "@": ["./src"],
        },
        unstable_moduleResolution: {
          type: "commonJS",
          rootDir: process.cwd(),
        },
      }),
    ],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
  },
});
