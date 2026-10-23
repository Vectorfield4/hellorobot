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

## Workflow
- Commit after every change (small, focused commits). Husky bumps the patch version on each commit.
