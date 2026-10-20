# hellorobot

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

## Structure

FSD + Atomic Design under `src/`. See `AGENTS.md`.
