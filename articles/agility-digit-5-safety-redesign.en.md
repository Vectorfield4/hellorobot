---
title: "Agility's Digit 5 weighs 120 kg so it can work without a safety cage"
slug: agility-digit-5-safety-redesign
date: 2026-10-19
tags: ["Agility Robotics", "Digit", "гуманоиды", "безопасность", "складская логистика"]
source_url: https://spectrum.ieee.org/agility-robotics-digit-5-redesign
status: draft
---

Agility Robotics has launched Digit 5, a humanoid meant to be the first that works next to people without fencing while lasting a full shift. The robot weighs more than 120 kg, lifts 23-kilogram bins onto shelves 1.75 metres high and is rated for 20 hours of work a day. A 90-minute battery recharges in nine minutes, so the gap between cycles barely affects the schedule.

Company founder Jonathan Hurst wrote up the launch in IEEE Spectrum. The result reads less like a press release than a confession: Digit 5 is the heaviest, most expensive and most compromised robot Agility will ever build. The light, graceful humanoid from his original plan turned out to be incompatible with warehouse requirements.

## Why the cage came off

Digit 4 worked behind physical barriers. Insurers and regulators required it: the robot had to be separated from people whenever it moved. That is fine for a demo and bad for the economics of a deployment. Fencing takes up floor space, forces the site to be rearranged and rules out places where people cannot be kept out of the way.

Certifiable safety took Agility two years. Digit 5's logic is deliberately conservative: when a person approaches, the robot stops, puts down its payload, sits on the floor and cuts power to its motors before anyone can reach it. Sensors sit inside protective housings, and the safety circuit runs on dedicated computers. This is not elegant avoidance of a human; it is a predictable retreat that is easier to prove to an auditor.

The approach shaped almost the whole design: the shape of the legs and body, the mass, the power draw, the dimensions. In return, Digit 5 was engineered for European CE, North American UL and FCC limits on electromagnetic radiation. Without those papers, a robot is simply not allowed on site.

## What the extra weight buys

A 20-hour shift and a 23 kg load are not a record — they are the NIOSH recommendation for a human worker, which Agility took as the floor. Lifting that weight to 1.75 m while precisely controlling contact force requires powerful and accurate actuators. They need a large battery, and the battery needs cooling.

The battery and cooling system take up about 75 percent of the torso. The dock delivers 240 A at 48 V: the cables visibly shake under magnetic forces, and fans push air through channels in the body. In exchange, the robot runs for 90 minutes and recovers its charge during a nine-minute break. For a warehouse that matters more than peak speed: the robot has to stop rarely, not run fast.

## Why the legs became human

The most visible change is a conventional human leg layout instead of the backward-knee "ostrich" design. The reversed arrangement worked well for running but got in the way of squatting: the ankle hit the floor. Digit 5 spends much of its time lifting loads from floor level, so the knee and hip actuators now push the body up together.

The price is dynamics. Digit 5 does not run or jump like earlier generations. Hurst compares it directly to a forklift and says the slender form he imagined has become physically impossible. His line about competitors is blunt: if a humanoid looks like a person on a factory floor, it either cannot lift the required weight or cannot last the shift; if it is not covered in sensors, it is not safe to stand next to.

## Production and the next step

Digit 5 will be built at RoboFab in Salem, Oregon. The site covers 70,000 square feet and is designed for more than 10,000 robots a year. For comparison, Cassie, Agility's first commercial biped, sold for $250,000, and the company sold just 10 of them to universities. Digit 4 worked at Amazon and became the first commercially deployed humanoid at the logistics operator GXO.

The roadmap goes beyond bins: piece picking, machine tending, preparing parts for assembly and eventually assembly itself. Interchangeable tool interfaces and a modular design allow subsystems to be upgraded gradually instead of replacing the whole robot.

The main question about Digit 5 is not its spec sheet but its price and long-term reliability. Agility has not disclosed the robot's cost or named customers willing to order a fleet of several thousand machines. For now it is a platform the company intends to learn scale on. The first numbers on mean time between failures and cost per hour will arrive only after the robots leave pilot sites.

Source: https://spectrum.ieee.org/agility-robotics-digit-5-redesign
