# hellorobot

Robotics news aggregator (with a minimal robot store on the side). Tagline:
"Последние новости робототехники — разработки, исследования, индустрия".
News are collected from robotics sources (RSS/Atom/HN) without API keys and published as
articles; the store side is a minimal WooCommerce-backed catalog.

## Architecture

- **Frontend:** Astro (islands architecture — SSG to SSR)
- **Backend:** WordPress + WooCommerce + WPGraphQL + WPGraphQL WooCommerce (WooGraphQL)
- **Component libraries:** React/Vue/Svelte — islands freely integrated into the monolith

## Frontend

- Rendering — server-side (WordPress)
- Frontend and backend integrated into a single monolith
- E-commerce frontend is server-rendered (WooCommerce)
- Rendering — on WordPress

## Stack

- Astro 7 (SSG) + React 19 + TypeScript 5 (strict)
- Biome 2 (lint/format), Vitest 3 (tests)
- Data via WPGraphQL at build time; synchronous fixture reads for local dev

## Commands

- `npm run dev` — start dev server
- `npm run build` — type-check and build
- `npm run test` — run tests
- `npm run lint` / `npm run format` — Biome

## WordPress MCP (optional)

To use the OpenCode WordPress MCP server, set the environment variable `HELLOROBOT_APP_PASSWORD`
to an application password for the WP admin user (username `admin` by default):

```bash
# Windows (user-level)
[Environment]::SetEnvironmentVariable("HELLOROBOT_APP_PASSWORD", "xxxx xxxx xxxx xxxx", "User")
```

## Article sources

Robotics news sources we parse (no API keys): [docs/article-sources.md](docs/article-sources.md).
The parsing code lives in the skills repo, mounted as `.opencode/skills/data`; this
repository keeps only the source list, `scripts/sources.json`.

```bash
npm run fetch:candidates                    # RSS/Atom/HN → candidates JSON
npm run extract:article -- <url>            # article body via Mozilla Readability
```
