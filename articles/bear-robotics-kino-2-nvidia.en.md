---
title: "Bear Robotics teaches its KR1 humanoid from demonstrations and makes GR00T eight times faster"
slug: bear-robotics-kino-2-nvidia
date: 2026-10-25
tags: ["Bear Robotics", "NVIDIA", "манипуляторы", "складская логистика", "навигация"]
source_url: https://www.koreasprint.com/news/articleView.html?idxno=21933
status: published
wp_id: 194
wp_url: https://hello-robot.ru/2026/10/25/bear-robotics-kino-2-nvidia/
---

Korean company Bear Robotics has introduced KINO-2, a training platform that turns recordings of human work into manipulation skills for its KR1 humanoid. It was announced on 21 October at NVIDIA GTC Berlin, alongside the public beta of NVIDIA Isaac OS.

Bear Robotics is known for service robots: 16,000 machines at 5,000 sites worldwide. They carry dishes, trays and bins but do not pick objects up by hand. KINO-2 is meant to move the business from transport to handling: pack an order into a box, feed material to a machine, process returns.

## How it works

The scheme is simple in words: an operator demonstrates the task, the system records motion, forces and outcome, and a model learns to reproduce the skill on KR1. The skill is then combined with navigation, fleet management and workflows that Bear has already tuned on its service fleet.

> "The people who actually do the work already understand the products, the equipment and the sequence. Through demonstrations we can capture that knowledge and teach it to the robot."
>
> — Bren Pierce, chief robotics officer at Bear Robotics

The platform supports both the company's own models and external foundation models such as NVIDIA Isaac GR00T, with a shared set of tools for training, evaluation and deployment.

## Why milliseconds matter

The technically interesting part is not the platform but the latency numbers. Bear built KINO-2 on NVIDIA Isaac OS running on Jetson AGX Thor and including Holoscan SDK 5.0. The link to the existing robotics stack goes through Isaac ROS Bridge.

On that runtime, GR00T inference dropped from about 500 ms to about 60 ms — roughly eight times faster by the company's internal measurement. Bear's own models went from 72.3 ms to 17.2 ms, or 4.2 times.

The gap between 500 and 60 ms is the gap between a robot that pauses and misses and one that corrects a grasp mid-motion. Manipulation is a closed loop: by the time a slow model answers, the object has moved.

> "The customer needs the whole operation completed: put the goods in the box, move it, bring the empty box back. We built navigation and infrastructure for moving things, and KINO-2 extends that to handling the objects themselves."
>
> — Fangwei Li, CTO of Bear Robotics

## What is left unsaid

The company names two pilots: supermarket returns and box handling in a warehouse. There are no public numbers for either — no grasp success rate, no cycle time, no fleet size.

The demo at the NVIDIA booth shows the full loop: KR1 picks bottles ordered through a warehouse management system, packs them into a box, drives the box to a drop-off point and returns with an empty one. That is manipulation and logistics joined together, which competitors usually show in separate pieces.

Prices, delivery dates and customer names are not disclosed. For the market this means KINO-2 is still a tool rather than a product: Bear's service robots sell in thousands, KR1 humanoids in single digits, and the move from fleet to manipulation has yet to be proven on someone else's floor.

Source: https://www.koreasprint.com/news/articleView.html?idxno=21933
