# Article sources

Robotics news candidates are collected **without API keys** by
`scripts/fetch-candidates.mjs` (`npm run fetch:candidates`).

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

## Company sources (specs)

Direct company blogs/pages, documented with the `source-explorer` skill:

- Boston Dynamics — `docs/capabilities/sources/boston-dynamics/blog.md` (HTML)
- Figure AI — `docs/capabilities/sources/figure-ai/news.md` (HTML)
- Unitree — `docs/capabilities/sources/unitree/news.md` (HTML)

These need HTML extraction (`scripts/extract-article.mjs`), not RSS.

## Universal article extractor

For HTML sources without RSS, use `scripts/extract-article.mjs`:

```bash
npm run extract:article -- https://example.com/article
```

It uses Mozilla Readability to pull title, byline, excerpt and full text from any
article page (no API keys). Output is JSON.

## Adding a source
Append an entry to the `SOURCES` array in `scripts/fetch-candidates.mjs`
(`type: "rss" | "atom" | "hn"`) and re-run the fetcher. Update this table's
"Parsing set up" column accordingly.
