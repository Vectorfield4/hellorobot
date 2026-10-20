# Article sources

Robotics news candidates are collected **without API keys** by
`scripts/fetch-candidates.mjs` (`npm run fetch:candidates`).

## Sources

| Source | Type | URL | Parsing set up |
|---|---|---|---|
| arXiv cs.RO | RSS | http://rss.arxiv.org/rss/cs.RO | ✅ |
| arXiv cs.AI | RSS | http://rss.arxiv.org/rss/cs.AI | ❌ |
| Google News (ru) | RSS | https://news.google.com/rss/search?q=робототехника | ✅ |
| IEEE Spectrum (robotics) | RSS | https://spectrum.ieee.org/rss/robotics | ✅ |
| The Robot Report | RSS | https://www.therobotreport.com/feed/ | ✅ |
| TechCrunch (Robotics) | RSS | https://techcrunch.com/category/robotics/feed/ | ❌ |
| Wired (Robots) | RSS | https://www.wired.com/feed/tag/robots/latest/rss | ❌ |
| Robotics 24/7 | RSS | https://www.robotics247.com/rss | ❌ |
| Automate.org / A3 | RSS | https://www.automate.org/rss | ❌ |
| Robotics Business Review | RSS | https://www.roboticsbusinessreview.com/feed/ | ❌ |
| Boston Dynamics blog | RSS | https://bostondynamics.com/blog/feed/ | ❌ |
| NVIDIA Robotics | RSS | https://developer.nvidia.com/blog/tag/robotics/feed/ | ❌ |
| ROS Discourse | RSS | https://discourse.ros.org/latest.rss | ❌ |
| OpenAI blog | RSS | https://openai.com/blog/rss.xml | ❌ |
| Papers With Code (Robotics) | HTML | https://paperswithcode.com/area/robotics | ❌ |
| Hugging Face Papers | RSS/JSON | https://huggingface.co/papers | ❌ |
| GitHub Trending (robotics) | HTML | https://github.com/trending?spoken_language_code=&since=daily | ❌ |
| Product Hunt (robots) | RSS | https://www.producthunt.com/feed?category=robots | ❌ |
| YouTube channels (Boston Dynamics, Figure AI, etc.) | RSS | https://www.youtube.com/feeds/videos.xml?channel_id=... | ❌ |
| Hacker News | JSON (Algolia) | https://hn.algolia.com/api/v1/search?query=robotics | ✅ |
| Reddit r/robotics | JSON | https://www.reddit.com/r/robotics/new.json | ⚠️ (403, often blocked) |
| Reddit r/ROS | JSON | https://www.reddit.com/r/ROS/new.json | ❌ |
| Reddit r/DroneTechnology | JSON | https://www.reddit.com/r/DroneTechnology/new.json | ❌ |
| Google Scholar alerts | RSS | (per-keyword feed) | ❌ |

## Deduplication
Candidates are deduplicated by URL. Already-published articles are tracked in
WordPress via the `_source_url` post meta (set when creating a draft through MCP).

## Adding a source
Append an entry to the `SOURCES` array in `scripts/fetch-candidates.mjs`
(`type: "rss" | "hn" | "reddit"`) and re-run the fetcher. Update this table's
"Parsing set up" column accordingly.
