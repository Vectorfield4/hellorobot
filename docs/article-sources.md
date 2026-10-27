# Article sources

Robotics news candidates are collected **without API keys** by the `news-fetcher`
skill — the engine lives in the global skills repo, this repository owns only the
source list.

| What | Where |
|---|---|
| Engine | `~/.config/opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs` (global skills repo) |
| Sources (this repo) | `scripts/sources.json` |
| Command | `node "$env:USERPROFILE/.config/opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs" --sources scripts/sources.json` |
| Company press centers (worldwide) | `docs/sources-robotics-worldwide.md` |
| Company feeds | Same `scripts/sources.json` — see [Company feeds](#company-feeds). `scripts/sources-companies.json` stays empty (single list, no second file to drift) |

This repository keeps no launcher: the skill script is called by its path in the
global mount, and `--sources` always names the file explicitly.

## Sources

| Source | Type | URL | Parsing set up |
|---|---|---|---|
| arXiv cs.RO | RSS | http://rss.arxiv.org/rss/cs.RO | ✅ |
| arXiv cs.AI | RSS | http://rss.arxiv.org/rss/cs.AI | ❌ |
| IEEE Spectrum (robotics) | RSS | https://spectrum.ieee.org/rss/robotics | ✅ |
| The Robot Report | RSS | https://www.therobotreport.com/feed/ | ✅ |
| TechCrunch (Robotics) | RSS | https://techcrunch.com/category/robotics/feed/ | ✅ |
| Wired (all) | RSS | https://www.wired.com/feed/ | ✅ |
| ROS Discourse | RSS | https://discourse.ros.org/latest.rss | ✅ |
| Robohub | RSS | https://robohub.org/feed/ | ✅ |
| Hacker News | JSON (Algolia) | https://hn.algolia.com/api/v1/search?query=robotics | ✅ |
| Google News (ru) | RSS | https://news.google.com/rss/search?q=робототехника | ❌ (исключён: RU-агрегаторы не нужны) |
| MONOist ロボット (ja) | RSS | https://rss.itmedia.co.jp/rss/2.0/mn_robot.xml | ✅ |
| ロボスタ (ja) | RSS (RDF) | https://robotstart.info/rss20/index.rdf | ✅ (часть ленты — プレミアム会員限定) |
| デンソーウェーブ (ja) | HTML | https://www.denso-wave.com/ja/robot/info/ | ✅ (без дат) |
| 中国机器人网 (zh) | HTML | https://www.robot-china.com/news/ | ✅ (без дат) |
| 智东西 Zhidx (zh) | HTML | https://zhidx.com/p/category/人工智能 | ✅ (без дат, только браузерный UA) |
| 雷锋网 Leiphone (zh) | RSS | https://www.leiphone.com/feed | ✅ |
| 量子位 Qbitai (zh) | RSS | https://www.qbitai.com/feed | ✅ |
| 中国AGV网 (zh) | HTML | https://www.chinaagv.com/ | ✅ (без дат) |
| Robotics 24/7 | HTML | https://www.robotics247.com/ | ❌ (нет RSS) |
| KUKA | JSON API (`json-list`) | https://www.kuka.com/en-us/api/news/GetPublications | ✅ |
| ABB (press releases) | JSON API (`json-list`) | https://www.abb.com/conf/abbcommon/services/newsbank.json | ✅ |
| NVIDIA Robotics | Atom | https://developer.nvidia.com/blog/tag/robotics/feed/ | ❌ (лента пустая) |
| Boston Dynamics | RSS | https://bostondynamics.com/feed/ | ❌ (200, empty channel) |
| Papers With Code (Robotics) | HTML | https://paperswithcode.com/area/robotics | ❌ |
| Hugging Face Papers | RSS/JSON | https://huggingface.co/papers | ❌ |
| GitHub Trending (robotics) | HTML | https://github.com/trending | ❌ |
| Product Hunt (robots) | RSS | https://www.producthunt.com/feed?category=robots | ❌ |
| YouTube channels | RSS | https://www.youtube.com/feeds/videos.xml?channel_id=... | ❌ |
| Reddit r/robotics | JSON | https://www.reddit.com/r/robotics/new.json | ⚠️ (403, часто блокируется) |
| Reddit r/ROS | JSON | https://www.reddit.com/r/ROS/new.json | ❌ |
| Google Scholar alerts | RSS | (per-keyword feed) | ❌ |

## Company feeds

Verified 2026-10-23 with the fetcher's own settings (`User-Agent: opencode-skills/1.0`,
15 s timeout): HTTP 200, XML with `<item>` elements, newest entry ≤ 90 days old.
All are RSS (`<item>`), so `type` is `rss`. Run the fetcher with
`--sources scripts/sources.json --out docs/research/candidates-companies.json`; 25 feeds
returned 589 candidates on that date.

| Company | Country | URL | Items | Newest |
|---|---|---|---|---|
| Intuitive Surgical | US | https://investor.intuitivesurgical.com/rss/news-releases.xml | 10 | 2026-10-20 |
| Medtronic | US | https://news.medtronic.com/press-releases?pagetemplate=rss | 5 | 2026-10-22 |
| CMR Surgical | GB | https://cmrsurgical.com/feed/ | 10 | 2026-10-12 |
| Comau | IT | https://www.comau.com/en/feed/ | 12 | 2026-10-22 |
| AutoStore | NO | https://www.autostoresystem.com/news/rss.xml | 10 | 2026-10-13 |
| Geek+ | CN | https://www.geekplus.com/resources/news/rss.xml | 10 | 2026-09-30 |
| GreyOrange | US | https://www.greyorange.com/feed/ | 10 | 2026-10-20 |
| Symbotic | US | https://ir.symbotic.com/rss/news-releases.xml | 10 | 2026-10-13 |
| Serve Robotics | US | https://ir.serverobotics.com/rss/news-releases.xml | 10 | 2026-10-22 |
| Ambi Robotics | US | https://www.ambirobotics.com/feed/ | 37 | 2026-09-17 |
| Bear Robotics | US | https://www.bearrobotics.ai/blog?format=rss | 20 | 2026-10-21 |
| Amazon Robotics | US | https://www.aboutamazon.com/news/tag/robotics/feed | 10 | 2026-10-08 |
| Clearpath Robotics | CA | https://clearpathrobotics.com/feed/ | 10 | 2026-10-14 |
| Robotiq | CA | https://blog.robotiq.com/rss.xml | 10 | 2026-09-22 |
| Neura Robotics | DE | https://neura-robotics.com/feed/ | 10 | 2026-10-22 |
| Robotnik | ES | https://robotnik.eu/feed/ | 10 | 2026-09-20 |
| Nomagic | PL | https://nomagic.ai/feed/ | 10 | 2026-10-19 |
| Rainbow Robotics | KR | https://rainbow-robotics.com/feed/ | 10 | 2026-10-02 |
| Palladyne AI (ex-Sarcos) | US | https://www.palladyneai.com/feed/ | 10 | 2026-10-07 |
| Teradyne | US | https://investors.teradyne.com/news-events/press-releases/rss | 10 | 2026-10-13 |
| MassRobotics | US | https://massrobotics.org/news/feed | 225 | 2026-10-22 |
| Viam | US | https://www.viam.com/post/rss.xml | 100 | 2026-09-22 |
| Quasi Robotics | US | https://quasi.ai/feed | 10 | 2026-10-16 |
| Hudson Robotics | US | https://www.hudsonlabautomation.com/feed | 10 | 2026-10-06 |
| EVS Robot | VN | https://www.evsint.com/feed | 10 | 2026-10-23 |

Notes:

- **Amazon Robotics** is a tag feed on the corporate newsroom, so occasional non-robotics
  Amazon stories slip in (weight 1.0).
- **Teradyne** and **Medtronic** are corporate feeds: robotics is a slice of the output
  (UR/MiR for Teradyne, Hugo RAS and Stealth AXiS for Medtronic).
- **Rainbow Robotics** mixes Korean and English posts under one `lang: "en"`.
- **MassRobotics** is an ecosystem organisation, not a vendor; it carries member-company news.

### Checked, no usable feed

Verified on the same date. These stay HTML-only, so the `article-extractor` skill is the
way in, not RSS.

| Company | Why not |
|---|---|
| Boston Dynamics | `bostondynamics.com/feed/` is 200 but the channel has zero items; `/blog/feed/` 404 |
| Agility Robotics | Webflow, no feed endpoint (all `/feed`, `/rss.xml` 404) |
| Apptronik | no feed; `/press-release` now 404, site restructured |
| Figure, 1X | Next.js sites, no feed |
| Unitree, UBTECH, Doosan Robotics | no feed endpoint; `/feed` 404 or redirects to homepage |
| FANUC, Yaskawa, Omron, Epson, Denso, Mitsubishi Electric | newsroom HTML only; every guessed RSS path 404 |
| Universal Robots | blog exists, but no discoverable feed (`/blog/rss.xml`, `/blog/feed/` 404) |
| Stäubli, Stryker | 403 to a non-browser user-agent (WAF), browser UA gives HTML not XML |
| Kawasaki Robotics | `kawasakirobotics.com/feed/` is a real feed but returns 403 to `opencode-skills/1.0`; works only with a browser UA |
| Locus Robotics | WordPress feed retired: `/feed/` and `/company/news-press/feed/` return 410 |
| Ocado Group | no feed endpoint (`/feed/`, `/newsroom/feed/`, `/rss.xml` 404) |
| Vecna Robotics, Business Wire | 200 with `application/rss+xml` but zero `<item>` elements |
| GlobeNewswire "Robotics" subject | feed is valid but carries unrelated releases (health, auctions), not robotics |

ABB and KUKA have no feed, but both render their newsroom from a JSON API, so they
are in `scripts/sources.json` as `json-list` (below).

## Japanese and Chinese publishers

Until 2026-10-26 Asia reached this repo only through the Google News aggregator
(`ja`, `zh`, `ko`): a retelling with the original publisher hidden behind a redirect.
The native feeds below were verified on that date by running the fetcher itself against
all twelve probed sources — 559 candidates, every title valid UTF-8, no mojibake.

What the probe changed versus the proposal: three broad feeds were dropped for noise
(`日経クロステック` — 100 items/day of general tech for ~1 robot, and partly paywalled;
`Response.jp` — 2 robots per 50 automotive items; `ITmedia AI+` — 15 % robots, mostly
Claude/Gemini coverage), and `ニュースイッチ` was dropped because its listing anchors carry
a `NEW` badge as the link text: 34 items came back all titled `NEW`.

| Source | Type | Items | Newest | Robots/day |
|---|---|---|---|---|
| MONOist ロボット | RSS | 30 | 2026-10-22 | ~0.5 (профильный) |
| ロボスタ | RSS (RDF) | 50 | 2026-10-23 | ~4 |
| デンソーウェーブ | HTML | 21 | без дат | ~0.2 |
| 中国机器人网 | HTML | 135 | без дат | ~4 (пик 18 в день выставки) |
| 智东西 Zhidx | HTML | 15 | без дат | ~1.5 |
| 雷锋网 Leiphone | RSS | 20 | 2026-10-24 | ~6 |
| 量子位 Qbitai | RSS | 10 | 2026-10-23 | ~1 |
| 中国AGV网 | HTML | 75 | без дат | ~10 (AGV и склад) |

### Undated HTML listings

`parseHtmlList` reads a date only from the text around the anchor itself
(`extractAnchorDate`). Five of these listings print the date in a sibling element, so
every item comes back with `date: null` — 中国机器人网 hands over 135 undated candidates.
That is the parser's shape, not a broken feed, and it is not worth editing the shared
`lib/article-search.mjs` for.

The policy for an undated item: take it **positionally** (listing order is newest first),
cap it at the top 20 per source, and confirm the real date from the article page before
writing anything. An undated candidate past the cap is not carried over to the next run —
the next fetch will surface it again if it is still near the top.

Two translation notes. A Japanese or Chinese story costs roughly twice the tokens of an
English one, because the whole text has to be translated rather than adapted, so the
`weight` values keep the profile publishers ahead of the general tech feeds. And
中国机器人网 and 中国AGV网 are 60–70 % vendor press releases and expo invitations
(«приглашаем на CeMAT Asia»): those are dropped at triage, not parsed.

These feeds run through `scripts/asia-lane.mjs` as a separate capped pool (see
[AGENTS.md](../AGENTS.md) §2): the lane filters `scripts/sources.json` to `lang: ja|zh`,
writes `docs/research/sources-asia.json`, calls the fetcher and keeps ~60 candidates
round-robin across publishers, so no single 100-item Google News feed fills the pool.
Translation terms are in [glossary-ja-zh.md](glossary-ja-zh.md).

### Checked, no usable source

Verified on 2026-10-26 with `opencode-skills/1.0` and a browser UA.

| Publisher | Why not |
|---|---|
| Robot Watch (`robot.watch.impress.co.jp`) | издание закрыто в 2009, сайт — заглушка, `/rss/index.rdf` 404 |
| 日本ロボット工業会 JARA | HTTP 503, «メンテナンス中» на трёх попытках |
| 高工机器人 GG-robot | истёк TLS-сертификат; по http — `socket closed` |
| 36Kr | клиентский рендер: ноль ссылок на статьи, `__NEXT_DATA__` отсутствует, `/feed` — HTML-шелл |
| 亿欧 iyiou | HTTP 202 + JS-челлендж, контента нет |
| OFweek 机器人 | `charset=gb1323` (опечатка в кодировке) — 147 заголовков нечитаемы |
| 机器之心 | `/rss` отдаёт пустое тело, `/rss/articles` 404 |
| 界面新闻 | `/rss/`, `/rss/tech.xml` 404 |
| 澎湃新闻, 新华社科技, C114 | нет RSS-точки; C114 вдобавок GB2312 и не робототехника |
| UBTECH, AgiBot, Fourier, Astribot | 200, но ленты новостей в HTML нет (JS-рендер или только лендинг) |
| 新松 SIASUN, 埃斯顿 Estun | таймаут соединения |
| 达闼 CloudMinds, 中国工控网 | ошибка проверки TLS-сертификата |
| FANUC Japan | `/ja/news/`, `/ja/newsroom/` 404; `/ja/profile/news/` — три карточки продуктов |
| Yaskawa Japan | одна ссылка на security alert, ленты нет |
| Mitsubishi Electric, Omron, Denso, THK | 403 для обоих UA; лента без href; 404 |
| 川崎重工 | 3888 ссылок без робораздела (суда, мотоциклы, авиация), селектор не сузить |
| Harmonic Drive | ноль ссылок на статьи в HTML |
| 大阪大学, 産総研, 東大 JSK, RRI | 404 на страницах новостей; JSK заморожен на 2015 |
| RIKEN | листинг рабочий, но life science: «ロボット» встречается один раз на всю ленту |
| 新浪科技 RSS | фид мёртв с 2018-09-23 |
| cnBeta | 150 записей, роботов 2 % |
| 电子发烧友 elecfans | 403 |

## Client-rendered newsrooms (`json-list`)

Both sites ship an HTML shell and hydrate the list from a JSON endpoint, so a link
scraper sees zero links. `type: "json-list"` reads the endpoint instead.

| Company | Endpoint | Shape |
|---|---|---|
| KUKA | `POST https://www.kuka.com/en-us/api/news/GetPublications` | form body `contextid=…&offset=0&count=500`; `items[]` with `headline`, `href`, `dateISO`; 263 items |
| ABB | `GET https://www.abb.com/conf/abbcommon/services/newsbank.json?requestType=getNewsList&feedId=…&pageNumber=0&cultureInfo=en&pageSize=20` | `news.items[]` with `title`, `id`, `newsUrlTitleSlug`, `scheduledPublishDate`; 20 items of 727 |

How each was found:

- **KUKA** — the news page (`/en-us/company/press/news`) carries the filter form
  itself: `data-url="/api/news/GetPublications"` plus hidden
  `contextid`/`takeCaptionsFromFacetId`. The app appends `offset`/`count`. The
  same API exists per market (`/en-us/api/...`), which is how the response's
  `href`s come back as `/en-us/...` instead of the `nl-be` default.
- **ABB** — the AEM `.model.json` of `/global/en/company/media` is a page model,
  not a list; the `newsgridpromo` component in it names
  `proxyServletPath: "/conf/abbcommon/services/newsbank"` and the feed ids
  (`6bbfaa…` group press releases). The servlet answers
  `.json?requestType=getNewsList&feedId=…`; item URLs are rebuilt with
  `urlTemplate` from `id` + `newsUrlTitleSlug`.

Caveats:

- KUKA's `contextid` is a constant copied from the page. If the endpoint starts
  returning `{"count":0,"items":[]}`, fetch the news page and read the hidden
  input again.
- ABB's `pageSize` accepts up to 100 (`pageSize=200` answers a non-list body);
  20 keeps the window at roughly seven months.
- ABB answered `403` twice while the endpoint was being inspected and `200` on
  every later call — a transient WAF block, not a required header.

## Deduplication

Candidates are deduplicated by URL (with tracking-param stripping). Coverage
against what is already on the site is a separate step: the `published-check`
skill matches a candidate by `source_url`, slug and normalized title against
`articles/` and, optionally, a WordPress dump.

The daily log is the second source of truth. Every publication writes
`docs/collected/<YYYY-MM-DD>.yaml` (`scripts/collected.mjs`): slug, `source_url`,
`wp_id`, timestamp, plus a file-level `ttl_days` / `expires`. It survives a
frontmatter that was never edited after an MCP publish, and it deletes itself:
`prune` removes files whose `expires` has passed.

```bash
node scripts/collected.mjs add --slug <slug> --url <source-url> --wp-id <id>
node scripts/collected.mjs export --out docs/research/collected.json
node "$env:USERPROFILE/.config/opencode/skills/data/published-check/scripts/check.mjs" \
  --file docs/research/candidates-<date>.json --articles articles --wp docs/research/collected.json
node scripts/collected.mjs prune
```

A WordPress post dump (`ewpa/get-posts` → `[{ "slug", "link", "status" }]`) can be
passed the same way when the archive may be behind the site. WordPress does not
store the source URL: `wp-client.mjs` drops `meta` and the MCP ability has no meta
field, so `_source_url` is not written anywhere.

## Universal article extractor

For HTML sources without RSS, the `article-extractor` skill pulls the body from any
article page with Mozilla Readability (no API keys):

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/article-extractor/scripts/extract-article.mjs" https://example.com/article
```

Output is JSON: `title`, `byline`, `excerpt`, `content`, `textContent`, `siteName`,
`url`.

### Publisher ladder (`scripts/extract-article.mjs`)

Readability is one generic pass, so a lazy-loaded body or a shift_jis newsroom costs a
story. The project keeps a three-rung ladder of its own for the publishers that actually
failed: JSON-LD `articleBody` → a verified per-publisher selector → a generic
densest-paragraph heuristic. `ok` is `checkBody` from `scripts/triage-candidates.mjs`
(300 words, mojibake), so a truncated body cannot pass as a short story.

```bash
node scripts/extract-article.mjs --url <url> [--out body.json]
```

Charsets are decoded from the header, then from a meta tag in the first 4 KB (MONOist
serves shift_jis and declares it only there), and `gb1323` — the OFweek typo — is read as
`gb18030` instead of throwing. A 403/404 gets exactly one retry, then an honest
`{ ok: false, reason: "http 403" }` and exit code 1.

Selectors below were verified on 2026-10-27 against live articles; each had to yield
≥300 words on three different articles, and the ones that failed went back to the generic
rung.

| Host | Selector | Result |
|---|---|---|
| irobotnews.com | `#article-view-content-div` | works (1265–1529 w) |
| therobotreport.com | `.entry-content` | works (619–899 w) |
| globaltimes.cn | `.article_content` | works (393–794 w) |
| infranken.de | `.text_teaser` | JSON-LD wins first (458–712 w); selector as fallback |
| briefia.fr | `main .prose` | works (403–741 w) |
| 01net.com | `.entry-content` | works (396–566 w) |
| itmedia.co.jp (MONOist, RSS at rss.itmedia.co.jp) | `#cmsBody .subscription` | works (656–836 w), shift_jis; `#cmsBody` alone adds the related list |
| robotstart.info | `article.arti-body` | works (950–2024 w) |
| robot-china.com | `#content` | works (462–631 w) |
| leiphone.com | `.lphArticle-detail` | works (476–1031 w) |
| qbitai.com | `div.article` | works (1436–3248 w) |
| zhidx.com | `div.post-content` | works (1641–2538 w) |
| chinaagv.com | `#viewcontentbox` | works (627–895 w) |
| prtimes.jp | `#press-release-body` | works (1077–3842 w) |

Two honest failures, both real: a Global Times photo report of 172 words and a zhidx
video post with no `<p>` at all. A publisher with no entry, or one who redesigns, falls
through to the generic rung by design.

## Adding a source

Append an entry to `scripts/sources.json`:

```json
{ "name": "Robotics 24/7", "url": "https://www.robotics247.com/feed/", "type": "rss" }
```

`type` is `rss`, `atom`, `hn`, `html-list` or `json-list`. No code change is needed.
Update this table's "Parsing set up" column accordingly. A `json-list` source also
needs its endpoint shape in [Client-rendered newsrooms](#client-rendered-newsrooms-json-list).

### Source weight from measurement

`weight` is not a promise, it is a number a run can supply. After a batch:

```bash
node scripts/source-yield.mjs --candidates docs/research/candidates-<date>.json \
  --shortlist docs/research/shortlist-<date>.json --collected docs/collected \
  --articles articles --out docs/research/source-yield.json
node scripts/source-yield.mjs apply --yield docs/research/source-yield.json --dry-run
```

Per source it counts `items`, `fresh`, `stories`, `surfaced`, `cited`, `published` and
`hostAttributed`, and proposes
`weight = clamp(0.6, 1.2, 0.6 + 2.0 × publishedRate)` with
`publishedRate = surfaced / stories`; a source with zero fresh items is unmeasured and
keeps its weight. `apply` rewrites only the number after `"weight":`, is idempotent, and
prints the before → after table; drop `--dry-run` to write.

Attribution is per published article, strongest evidence first:

| rule | evidence | how it is counted |
| --- | --- | --- |
| `url` | the article's `source_url` is one of this run's candidates | `surfaced` for the feed that carried that URL |
| `story` | the article matches a shortlisted cluster by a `retold` URL or by title | `surfaced` for the feed whose item matched |
| `host` | the article's host is one of the feed's candidate hosts | `hostAttributed`, printed, not evidence |

`surfaced` and `cited` are deliberately separate. `cited` is what we quoted — the
article's `source_url` sits on that feed's host. `surfaced` is what the feed is for: it
brought the story, even when the article quotes somebody else's URL. An aggregator's
candidates always point at `news.google.com`, so its `cited` is zero by construction
while its `surfaced` is the honest number; the weight is fed by `surfaced` for that
reason. The report ends with the articles no story could claim, each marked `[host]`
(only the host rule explains it) or `[none]` (nothing does), so a bad credit is visible
rather than averaged away.
