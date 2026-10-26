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
- Posts via WPGraphQL at build time; products via WooCommerce Store API (`/wp-json/wc/store/v1`).
- Demo product fixtures are dev-only; a production build without a store renders an empty catalog.

## Structure
FSD + Atomic Design under `src/`.

## Content pipeline

Articles are a single markdown file each: `articles/<slug>.ru.md`. The site serves
one locale (`astro.config.ts`, `i18n.locales: ["ru"]`), so there is no EN mirror:
an `.en.md` file gets no route, no reader and no build consumer, and only doubles
the tokens of every later read of the story. Do not write one.
There is no `content/plan/`, no generation queue, no cover gate and no related entities,
so `write-article` does not apply here.

Call the `content-translate-related-articles` agent and name what you want:

> find fresh robotics news, skip what is already published, translate the rest and publish to WordPress

It runs the chain below in order and stops at the first gate that says "already done".

### 0. Volume per run

One run is a batch, not a story. Target **12–15 articles on a weekday, 7–9 at the
weekend**. The weekend figure is lower because supply is lower, not because the filter
is looser: arXiv carries `skipDays: Saturday, Sunday` and ships an empty channel, and
most press centres hold releases until Monday. A run on a Saturday night sees roughly
the same candidate count as a weekday but half of it already stale.

The number is a target, never a quota. If fewer stories clear the gates, publish fewer
and report the shortfall — never fill a batch by lowering the bar.

Keep the mix inside the batch, no more than two stories of one kind:

| Kind | Per batch |
| --- | --- |
| Funding and rounds | 3–4 |
| Manufacturing and factories | 2–3 |
| Deployments and case studies | 2–3 |
| Research and hardware | 2–3 |
| Market and economics | 1–2 |

Quality floor, the rules that stay no matter the target:

- Dedupe by **story**, not by URL. A retelling of a published story in another language
  is a duplicate; `published-check` does not catch it, so read the post list too.
- A platform may return within days when the **fact** is new (Nickel: a new battery for
  Digit, not a third "Digit walks" piece). Refuse repetition of the fact, not the robot.
- Unparseable once means one fallback attempt (publisher URL, then archive.org), then
  drop the candidate and log the reason. Do not spend a story on a paywalled stub.
- No story from a video, a LinkedIn post or an opinion column without a verifiable fact
  in it.

### 1. Sources

- `docs/sources-robotics-worldwide.md` — company press centres and feeds by country.
- `docs/article-sources.md` — which feeds are wired, which are HTML-only, which are client-rendered.
- `scripts/sources.json` — what the fetcher actually reads. Add a source here, update the table.
- Asia runs on native publishers, not only the Google News aggregator: `MONOist ロボット`,
  `ロボスタ`, `デンソーウェーブ` (ja) and `中国机器人网`, `雷锋网`, `量子位`, `智东西`,
  `中国AGV网` (zh). Five of them are HTML listings whose items arrive without a date —
  take them positionally, top 20, and confirm the date on the article page.

### 2. Find articles

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs" \
  --sources scripts/sources.json --out docs/research/candidates-<date>.json
```

Topic-scoped runs: `thematic-article-search --topic <topic> --sources scripts/sources.json`.

### 3. Skip what is already published

Story-level triage first, then `published-check` for the cases triage cannot see:

```bash
node scripts/triage-candidates.mjs \
  --file docs/research/candidates-<date>.json \
  --from <date> --to <date> --known-articles articles \
  --top 40 --out docs/research/shortlist-<date>.json
```

It collapses one event into one story — a vendor release, a trade-press write-up, a
Google News rerun and two translated retellings become a single cluster whose `retold`
list keeps every URL — and it ranks the survivor: the actor of the story beats trade
press, which beats an aggregator. Drop rules ride along, each with a reason in
`dropped`: expo invitations, webinars, award lists, concept renders, stale dates,
undated listings past the positional cap of 20.

`stats.covered` is the archive check: a cluster whose story is already published is
excluded from the shortlist and named in `covered` with the article slug. Read it
before parsing anything.

Then the second pass, for what is live in WordPress but not yet in the archive:

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/published-check/scripts/check.mjs" \
  --file docs/research/candidates-<date>.json --articles articles \
  --wp docs/research/collected.json --out docs/research/coverage-<date>.json
```

`--wp` takes any post-shaped dump: the exported daily log
(`node scripts/collected.mjs export --out docs/research/collected.json`) or a
`ewpa/get-posts` dump.

Read `covered` before touching the story:

- `matched.status: published` — the article is live, skip.
- `matched.status: draft` — the article was started but is not live, finish it, do not fetch again.
- `matched.kind: wp_slug` / `wp_url` — post is live in WordPress, the archive is behind: backfill, do not republish.

### 4. Read the body

`article-extractor` per fresh URL; `try-parse-url` only on an error or a truncated body.
Read the full text before writing.

The parser lies quietly: a paywall or a JS shell yields 88 words and looks like a short
story. Gate every body before translating it:

```bash
node scripts/triage-candidates.mjs body --file <extracted-body.txt>
```

`fail: too-short` or `fail: mojibake` means extract again or drop the candidate — never
write an article from that body. 300 words is the floor for a news item.

### 5. Translate

`translate-article` produces one file, `articles/<slug>.ru.md`, in the site language.
It keeps the frontmatter contract from `articles/README.md`: `title`, `slug`, `date`,
`tags`, `source_url`, `status` (`draft` | `published`), and `wp_id` / `wp_url` after
publication. No `.en.md`: the site has a single locale, so a second file would only
duplicate the text.

Then the last duplicate gate, now that the text is in Russian and comparable to what is
already published:

```bash
node scripts/triage-candidates.mjs draft --file articles/<slug>.ru.md --known-articles articles
```

`duplicate` means a published article already tells this story: stop, or make the piece
about the new fact. This is the gate that catches a story translated twice from two
retellings in two languages — the candidate titles never matched, the Russian ones do.

### 6. Make sure the story has something to sell

Every article ends with the «Купить робота» block, and the block renders only when at least
one post tag has a published product. A gap is closed by running the shop tree — it finds a
robot with that tag, gates it and publishes it:

```
/add-products тег: <tag>        # or just: добавь товары
```

The nodes live in the skills repo (`~/.config/opencode/skills/content/shop-*`); the project
keeps no shop script. Costs and policy are in [docs/products.md](docs/products.md): tags are
functional, brands are an internal allowlist in `data/<host>/sellers.yaml`, and prices stay
in `data/<host>/prices.yaml` — WooCommerce gets `regular_price: "0"` and the page shows the
robot, not a number. Matching is canonical (`src/shared/config/productTags.ts`): `humanoid`
and `гуманоиды` are the same tag.

### 7. Publish

WordPress MCP (`ewpa/create-post` with `status`) when the session has it, otherwise
`wp-publish --config <site>.json --file docs/wp-<slug>.json` after a `--dry-run`.
Then `wp-record` writes `wp_id` / `wp_url` / `status` back into the article file, and
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

### 8. Verify

`npm run lint`, `npm run test`, `npm run build`. The build reads posts through WPGraphQL and
products through the Store API, not markdown: a new article file adds no page until the post is
published, and the page count grows only after step 7. Commit the article file and
`docs/collected/<date>.yaml` together, with `content:` or `news:`.

## Workflow
- Commit after every change (small, focused commits). Husky bumps the patch version on each commit.
