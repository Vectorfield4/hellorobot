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
`articles/` and, optionally, a WordPress dump, and returns `{ fresh, covered }`.

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/published-check/scripts/check.mjs" \
  --file docs/research/candidates-<date>.json --articles articles --wp docs/research/wp-posts.json
```

Already-published articles are also tracked via the `_source_url` post meta when
creating drafts through MCP.

## Universal article extractor

For HTML sources without RSS, the `article-extractor` skill pulls the body from any
article page with Mozilla Readability (no API keys):

```bash
node "$env:USERPROFILE/.config/opencode/skills/data/article-extractor/scripts/extract-article.mjs" https://example.com/article
```

Output is JSON: `title`, `byline`, `excerpt`, `content`, `textContent`, `siteName`,
`url`. There is no extraction code and no launcher in this repository.

## Adding a source

Append an entry to `scripts/sources.json`:

```json
{ "name": "Robotics 24/7", "url": "https://www.robotics247.com/feed/", "type": "rss" }
```

`type` is `rss`, `atom`, `hn`, `html-list` or `json-list`. No code change is needed.
Update this table's "Parsing set up" column accordingly. A `json-list` source also
needs its endpoint shape in [Client-rendered newsrooms](#client-rendered-newsrooms-json-list).
