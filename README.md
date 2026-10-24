# hellorobot

Robotics news aggregator with a robot catalog on the side. Tagline:
"Последние новости робототехники — разработки, исследования, индустрия".
News are collected from robotics sources (RSS/Atom/HN) without API keys and published as
articles; the catalog is a WooCommerce store on `hello-robot.ru`, read at build time.

## Architecture

- **Frontend:** Astro 7, static (SSG) with React 19 islands, deployed over FTP
- **Backend:** WordPress + WooCommerce + WPGraphQL on `hello-robot.ru`
- **Catalog reads:** WooCommerce Store API (`/wp-json/wc/store/v1`), no keys, at build time
- **Search:** live Store API from the browser, falling back to the build-time index
- **Orders:** `POST /wp-json/hellorobot/v1/order` — a WordPress mu-plugin creates a real
  WooCommerce order (`on-hold`, no payment on the site)

There is no Node runtime in production: pages are static HTML, and only search and the
order form talk to WordPress at request time.

## Stack

- Astro 7 (SSG) + React 19 + TypeScript 5 (strict)
- Biome 2 (lint/format), Vitest 3 (tests)
- Posts via WPGraphQL at build time; products via Store API; demo product fixtures in dev

## Commands

- `npm run dev` — start dev server
- `npm run build` — type-check and build
- `npm run test` — run tests
- `npm run lint` / `npm run format` — Biome

## Catalog

| Route | What |
|---|---|
| `/products` | catalog grid, tag chips, live search |
| `/products/<slug>` | product card, price, stock, order form, related products and articles |
| `/products/tag/<tag>` | products by tag |
| `/products/category/<name>` | products by category |
| `/products/page/<n>` | catalog pagination |

Products inherit the blog's tag vocabulary, so an article about humanoids shows humanoid
robots under "Купить робота". Tag matching lives in `src/shared/config/productTags.ts`
(canonical name + EN/RU aliases); the catalog data layer is `src/shared/data/products.ts`.

An article can force a block at a chosen place with a marker in the WordPress post:

```html
<!-- buy-robot -->                 → products by the post's own tags
<!-- buy-robot: гуманоиды, коботы --> → products by the listed tags
```

Without a marker the block is appended after the article body.

### Catalog environment

- `PUBLIC_WP_URL` — WordPress base (Store API and order endpoint are derived from it);
  defaults to the host of `PUBLIC_WP_GRAPHQL_URL`.
- `PUBLIC_PRODUCTS_FALLBACK=demo` — show demo products when the store is unreachable.
  Dev server always shows them; a production build without this renders an empty catalog.

### Products into WooCommerce

```bash
# the shop tree lives in the global skills repo, not in this project
/add-products                    # or: node "$env:USERPROFILE/.config/opencode/skills/content/shop-audit/scripts/audit.mjs"
```

The tree audits article tags, harvests brand catalogues, maps models to blog tags, gates on
trusted brand + uniqueness + spec, merges `products/catalog.json` and writes to WooCommerce.
Prices never reach WordPress: they stay in `data/<host>/prices.yaml` and are given on the
phone. See [docs/products.md](docs/products.md).

## WordPress side

`wp/mu-plugins/hellorobot-commerce.php` adds the order endpoint, the `/health` probe and CORS
for `hellorobot.ru`. Install by copying it into `wp-content/mu-plugins/`; see
[wp/README.md](wp/README.md) for prerequisites and curl checks.

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
