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

Call the `content-translate-related-articles` agent and name what you want:

> find fresh robotics news, skip what is already published, translate the rest and publish to WordPress

It runs the chain below in order and stops at the first gate that says "already done".

### 1. Sources

- `docs/sources-robotics-worldwide.md` — company press centres and feeds by country.
- `docs/article-sources.md` — which feeds are wired, which are HTML-only, which are client-rendered.
- `scripts/sources.json` — what the fetcher actually reads. Add a source here, update the table.

### 2. Find articles

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs" \
  --sources scripts/sources.json --out docs/research/candidates-<date>.json
```

Topic-scoped runs: `thematic-article-search --topic <topic> --sources scripts/sources.json`.

### 3. Skip what is already published

Two passes: `candidates-triage` (dedupe the dump by canonical URL, filter, cap), then
`published-check` against this repo's archive and, when available, a WordPress dump:

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/published-check/scripts/check.mjs" \
  --file docs/research/candidates-<date>.json --articles articles \
  --wp docs/research/collected.json --out docs/research/coverage-<date>.json
```

`--wp` takes any post-shaped dump: the exported daily log
(`node scripts/collected.mjs export --out docs/research/collected.json`) or a
`ewpa/get-posts` dump. `--wp` is optional; the archive alone already covers most
cases, but the log catches posts published before the frontmatter was updated.

Read `covered` before touching the story:

- `matched.status: published` — pair and translation exist, skip.
- `matched.status: draft` — pair started but not live, finish it, do not fetch again.
- `matched.kind: wp_slug` / `wp_url` — post is live in WordPress, the archive is behind: backfill, do not republish.

### 4. Read the body

`article-extractor` per fresh URL; `try-parse-url` only on an error or a truncated body.
Read the full text before writing.

### 5. Translate

`translate-article` produces the RU article and the EN mirror. Both keep the frontmatter
contract from `articles/README.md`: `title`, `slug`, `date`, `tags`, `source_url`,
`status` (`draft` | `published`), and `wp_id` / `wp_url` after publication. EN is at least
90% of RU — no stub.

### 6. Publish

WordPress MCP (`ewpa/create-post` with `status`) when the session has it, otherwise
`wp-publish --config <site>.json --file docs/wp-<slug>.json` after a `--dry-run`.
Then `wp-record` writes `wp_id` / `wp_url` / `status` back into both language files, and
`wp-sync-tags` assigns the frontmatter tags.

Finally record the source in the daily log — this is what survives a forgotten
frontmatter edit:

```bash
node scripts/collected.mjs add --slug <slug> --url <source-url> --wp-id <id>
```

The file is `docs/collected/<YYYY-MM-DD>.yaml` with `ttl_days: 7` and an `expires`
date; `node scripts/collected.mjs prune` deletes the files whose TTL is over, so the
log stays a week-wide "already taken" window and never turns into an archive. The
permanent record is still the article frontmatter.

### 7. Verify

`npm run lint`, `npm run test`, `npm run build`. The build reads WordPress through
WPGraphQL, not markdown: a new pair adds no page until the post is published, and the page
count grows only after step 6. Commit the article pair and `docs/collected/<date>.yaml`
together, with `content:` or `news:`.

## Workflow
- Commit after every change (small, focused commits). Husky bumps the patch version on each commit.
