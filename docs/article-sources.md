# Article sources

Robotics news candidates are collected **without API keys** by
`scripts/fetch-candidates.mjs` (`npm run fetch:candidates`).

## Sources parsed

| Source | Type | URL | Notes |
|---|---|---|---|
| arXiv cs.RO | RSS | http://rss.arxiv.org/rss/cs.RO | Robotics papers/preprints |
| Google News (ru) | RSS | https://news.google.com/rss/search?q=робототехника | Russian-language news |
| IEEE Spectrum (robotics) | RSS | https://spectrum.ieee.org/rss/robotics | IEEE robotics coverage |
| The Robot Report | RSS | https://www.therobotreport.com/feed/ | Industry news |
| Hacker News | JSON (Algolia) | https://hn.algolia.com/api/v1/search?query=robotics | Community discussions |
| Reddit r/robotics | JSON | https://www.reddit.com/r/robotics/new.json | Often blocked (403); optional |

## Deduplication
Candidates are deduplicated by URL. Already-published articles are tracked in
WordPress via the `_source_url` post meta (set when creating a draft through MCP).

## Adding a source
Append an entry to the `SOURCES` array in `scripts/fetch-candidates.mjs`
(`type: "rss" | "hn" | "reddit"`) and re-run the fetcher.
