# Article sources

Robotics news candidates are collected **without API keys** by the `news-fetcher`
skill — the engine lives in the global skills repo, this repository owns only the
source list.

| What | Where |
|---|---|
| Engine | `.opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs` |
| Sources (this repo) | `scripts/sources.json` |
| Launcher | `scripts/fetch-candidates.mjs` (`npm run fetch:candidates`) |

The launcher adds `--sources scripts/sources.json` when the flag is missing, so the
command works from any directory.

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
| NVIDIA Robotics | Atom | https://developer.nvidia.com/blog/tag/robotics/feed/ | ❌ (лента пустая) |
| Boston Dynamics | RSS | https://bostondynamics.com/feed/ | ❌ (404) |
| Papers With Code (Robotics) | HTML | https://paperswithcode.com/area/robotics | ❌ |
| Hugging Face Papers | RSS/JSON | https://huggingface.co/papers | ❌ |
| GitHub Trending (robotics) | HTML | https://github.com/trending | ❌ |
| Product Hunt (robots) | RSS | https://www.producthunt.com/feed?category=robots | ❌ |
| YouTube channels | RSS | https://www.youtube.com/feeds/videos.xml?channel_id=... | ❌ |
| Reddit r/robotics | JSON | https://www.reddit.com/r/robotics/new.json | ⚠️ (403, часто блокируется) |
| Reddit r/ROS | JSON | https://www.reddit.com/r/ROS/new.json | ❌ |
| Google Scholar alerts | RSS | (per-keyword feed) | ❌ |

## Deduplication

Candidates are deduplicated by URL (with tracking-param stripping). Already-published
articles are tracked via the `_source_url` post meta when creating drafts through MCP.

## Universal article extractor

For HTML sources without RSS, the `article-extractor` skill pulls the body from any
article page with Mozilla Readability (no API keys):

```bash
npm run extract:article -- https://example.com/article
```

Output is JSON: `title`, `byline`, `excerpt`, `content`, `textContent`, `siteName`,
`url`. The launcher in `scripts/extract-article.mjs` points at the skill mounted under
`.opencode/skills/data/article-extractor`; there is no extraction code in this repository.

## Adding a source

Append an entry to `scripts/sources.json`:

```json
{ "name": "Robotics 24/7", "url": "https://www.robotics247.com/feed/", "type": "rss" }
```

`type` is `rss`, `atom` or `hn`. No code change is needed. Update this table's
"Parsing set up" column accordingly.
