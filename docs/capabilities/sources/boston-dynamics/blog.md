# Source. Company blog for Boston Dynamics

Status: draft

## Company
Boston Dynamics, Inc. (owned by Hyundai Motor Group). Robotics company: Spot, Atlas, Stretch. Private; no ticker.

## What to fetch
URL: `https://bostondynamics.com/blog/`
Method: HTML fetch (no public RSS — `/feed/` returns an empty channel, `/blog/feed/` is 404).
Frequency: weekly. Pagination: "Browse All Blogs" list; no session tokens observed.

## What is in it
- Article title, URL (`/blog/<slug>/`), publication date, category (Innovation, Product News, Safety, Trends in Robotics, Warehouse Robotics).
- Article body: product announcements, R&D write-ups, case studies.
- Stable: slug URL pattern and category set. Changes: new posts, featured hero.

## Discovery context
Linked from the site's Resources → Blogs, and from the homepage nav "News" → `/news/`.

## Impact hypothesis
Product/partnership announcements (e.g. Atlas deployments, Spot payloads) are primary-source signals for the humanoid/quadruped market. Useful for news posts and "company watch" items.

## AI debates needed
No.

## Test cases
- URL: `https://bostondynamics.com/blog/robot-hands-for-modern-ai-and-real-work/`
- Expected: title contains "Robot Hands", category "Product News" or "Blog", body length > 1000 chars.
