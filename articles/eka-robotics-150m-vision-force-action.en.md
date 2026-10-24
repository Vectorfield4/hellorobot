---
title: "Eka Robotics raises $150M to teach robots to feel force instead of copying humans"
slug: eka-robotics-150m-vision-force-action
date: 2026-10-25
tags: ["Eka Robotics", "стартапы", "манипуляторы", "обучение с подкреплением", "Physical AI"]
source_url: https://www.therobotreport.com/eka-robotics-raises-150m-scale-vision-force-action-model-robots
status: published
wp_id: 190
wp_url: https://hello-robot.ru/2026/10/25/eka-robotics-150m-vision-force-action/
---

Eka Robotics has raised a $150 million Series A. The company was founded in 2024 in Cambridge, Massachusetts, and is building a vision-force-action (VFA) model: it teaches a robot to predict how an object will behave under load rather than replay an operator's hand motion.

The round was led by Andreessen Horowitz and F-Prime, a fund affiliated with FMR LLC, the parent of Fidelity Investments. Obvious Ventures and E14 Fund stayed from the seed round; MFV Partners, Bison Ventures, Glasswing Ventures, Samsung Next and several Fortune 500 strategics joined.

## What the company claims

Eka says its robots pick objects outside the training distribution at roughly 1,500 operations per hour. They can screw in a light bulb and insert wires. This is meant as a general manipulation skill, not a single-task demo.

The 1,500 figure is the company's own claim, not an independent measurement. In a factory it only means something next to the success rate: a thousand picks an hour at 60% is worse than four hundred at 95%.

## Why not human data

Eka's argument is that copying human demonstrations does not scale: the dataset is expensive and covers little of the real world's variety. Instead the team generates experience in simulation — thousands of hours of object interaction in minutes of machine time, with varied objects, environments and physical conditions.

Training uses reinforcement learning, and the "intuition" comes from reasoning about vision and forces together. The usual simulation-to-reality gap, the company says, is shrinking — and that claim is exactly what needs outside verification.

> "Eka's Vision-Force-Action model is the first approach I've seen that truly solves manipulation with the generality and throughput needed for deployments."
>
> — Raghu Raghuram, general partner at Andreessen Horowitz

The second argument is performance over thousands of repetitions. Shyam Kamadolli of Fine Structure Ventures says a robot's value on the factory floor comes down to two numbers: success rate and speed.

## Where the market starts

Manipulation is the most expensive and most fragmented part of robotics. Warehouses need repacking, sorting and packing; factories need assembly and part insertion; labs need sample handling. Today these tasks either stay with people or are automated by rigid machines built for one part.

Eka promises generality, which puts it alongside companies that train robots on video and teleoperation. That argument is not settled, but Eka has a measurable metric — operations per hour — and the money to carry it to customer sites.

## What to check

First, customers: the company does not say how many robots work on external sites or what they do in a shift. Second, cost per operation including downtime and maintenance. Third, how the model behaves on new objects six months after deployment: generality shows up in task drift, not in a demo.

So far the confirmed facts are the sum, the investors and the claimed speed. For a round this size that is enough to keep going, but not enough to call manipulation solved.

Source: https://www.therobotreport.com/eka-robotics-raises-150m-scale-vision-force-action-model-robots
