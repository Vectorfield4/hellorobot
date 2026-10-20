# Source. Company news for Figure AI

Status: draft

## Company
Figure AI, Inc. (Figure). Humanoid robotics (Figure 03, Helix). Private; no ticker.

## What to fetch
URL: `https://www.figure.ai/news`
Method: HTML fetch (no RSS found). Frequency: weekly. Pagination: "Load More" button (client-side; may need scrolling or the underlying JSON endpoint).

## What is in it
- Article title, URL (`/news/<slug>`), date, cover image.
- Body: product milestones, funding, partnerships, Helix model updates.
- Stable: `/news/<slug>` pattern. Changes: chronological list, featured three at top.

## Discovery context
Site navigation "NEWS" → `/news`; linked from the company homepage.

## Impact hypothesis
Primary-source humanoid milestones (production ramp, BMW deployments, funding) are high-value signals for the humanoid robotics narrative.

## AI debates needed
No.

## Test cases
- URL: `https://www.figure.ai/news/introducing-figure-03`
- Expected: title contains "Introducing Figure 03", body length > 500 chars.
