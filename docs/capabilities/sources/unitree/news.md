# Source. News center for Unitree

Status: draft

## Company
Yushu Technology Co., Ltd. (Unitree Robotics). Quadrupeds, humanoids, LiDAR. Private; no ticker.

## What to fetch
URL: `https://www.unitree.com/news`
Method: HTML fetch (no RSS found). Frequency: weekly. Pagination: none observed — the list appears to be a single page.

## What is in it
- Article title, URL (`/news/<id>`), date, cover image, category ("Media Coverage").
- Body: product launches, partnerships, events, media mentions.
- Stable: `/news/<id>` pattern. Changes: list order, new items.

## Discovery context
Site "Explore → News" and footer "News Center".

## Impact hypothesis
Low-cost humanoid/quadruped launches (G1, R1, H2 Plus) move the commodity-robotics narrative; early product signals matter for price/competition coverage.

## AI debates needed
No.

## Test cases
- URL: `https://www.unitree.com/news/40`
- Expected: title contains "H2 Plus" or "NVIDIA Isaac GR00T", date 2026-06-01, body length > 300 chars.
