import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import stylex from "@stylexjs/unplugin/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? "https://hellorobot.ru",
  trailingSlash: "never",
  integrations: [react(), sitemap()],
  build: {
    // Keep page CSS as external, render-blocking assets: StyleX appends its
    // collected rules to the shared layout stylesheet during the build, and
    // inlining would drop them from the first paint.
    inlineStylesheets: "never",
  },
  i18n: {
    defaultLocale: "ru",
    locales: ["ru"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [
      stylex({
        useCSSLayers: true,
        // In dev the stylesheet link below is the source of truth (blocking, so
        // no flash of unstyled cards); css-only serves the HMR cache-bust shim.
        devMode: "css-only",
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
