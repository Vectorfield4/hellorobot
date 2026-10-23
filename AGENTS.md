# hellorobot

## Stack
Astro 7 (SSG) + React 19 + TypeScript 5 strict + Vitest + Biome 2

## Commands
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run format`

## Tooling
- Biome is the sole linter/formatter.
- i18n is build-time `createT`.
- Data is synchronous fixture reads; WordPress/WooCommerce via WPGraphQL at build time.

## Structure
FSD + Atomic Design under `src/`.

## Content pipeline
Articles are plain markdown pairs: `articles/<slug>.ru.md` + `articles/<slug>.en.md`.
There is no `content/plan/`, no generation queue, no cover gate and no related entities,
so `write-article` does not apply here.

Call the `content-news-pipeline` agent and name what you want:

> add two fresh robotics articles from `scripts/sources.json`, RU + EN, verify and commit

The agent runs `news-fetcher` -> `article-extractor` -> `translate-article`, then
optionally `wp-publish` / `wp-record` / `wp-sync-tags`. Source list and parsing notes:
`docs/article-sources.md`; frontmatter contract: `articles/README.md`.

## Workflow
- Commit after every change (small, focused commits). Husky bumps the patch version on each commit.
