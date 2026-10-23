---
title: "NVIDIA taught a $399 Microduck to walk in Isaac Lab: 4,096 copies at 1.25 million steps a second"
slug: microduck-isaac-lab-walking-policy
date: 2026-10-21
tags: ["NVIDIA", "Hugging Face", "обучение с подкреплением", "sim-to-real", "открытое железо"]
source_url: https://huggingface.co/blog/nvidia/microduck-isaac-lab-sim-to-real
status: draft
---

NVIDIA and Hugging Face published a step-by-step walkthrough on 21 October: how to train a walking gait for the open-source biped Microduck in simulation and transfer the finished policy to hardware. Microduck costs $399, weighs about 800 grams, stands 25 centimetres tall and is driven by 15 motors. It is not a demo toy but a testbed for the whole path from parallel simulation to an ONNX file on board.

The robot was built by Pollen Robotics and Hugging Face. Its appeal is that it lowers the entry barrier: a similar training loop used to require a lab arm costing tens of thousands of dollars and a team to run the infrastructure. Now the same loop runs on a desktop device.

## 4,096 copies instead of one

Training runs in Isaac Lab, a framework built around GPU-parallel environments. The base command starts 4,096 copies of Microduck at once. The policy receives 61 observation values and outputs 14 target joint positions. In a distributed setup on 16 GPUs with rough terrain and gearbox backlash, training reaches up to 1.25 million steps per second.

The point is that the robot learns not from a single trajectory but from thousands of slightly different ones. Each copy gets its own state: mass, friction, battery voltage, command latency. The policy is forced to find a solution that works not in an ideal world but across a range of conditions.

## Where simulation usually lies

The main reason a gait trained in simulation falls apart on a real robot is the actuators. In simulation a motor obediently delivers the commanded torque; in hardware there is controller firmware, current limits, friction, thermal drift and response delay. The authors use Newton with the MJWarp solver and the Better Actuator Models (BAM) approach, which turns position commands into realistic torques while accounting for those effects.

Backlash is modelled separately — the mechanical play in a gearbox that makes a joint take up slack before it starts moving. Backlash is set independently for every joint so the policy sees uneven wear. Then domain randomisation kicks in: mass and centre of mass, ground friction, joint inertia, encoder offsets, battery voltage sag, command latency, pushes and varied terrain.

This is not decoration but a way to make training more honest. If a policy survives random shoves and loose gearboxes, it has a better chance of not falling on the first carpet.

## ONNX and the move to hardware

After training, the policy is checked in the Newton visualiser and exported. The standard RSL-RL workflow saves two files: TorchScript and ONNX. The Microduck on-board runtime loads the ONNX file. During export, the observation order, normalisation and action scaling must be preserved — the slightest mismatch with training turns the gait into a twitch.

The file is then copied to the robot over scp, loaded with `robotctl policy load walk` and checked through `robotctl monitor`. If something goes wrong, `robotctl policy reset walk` restores the factory policy. The accompanying video shows Microduck getting up after a fall and continuing to walk — the robustness check that simulation promised.

There is also a shared benchmark: Microduck Arena on Hugging Face accepts models with the same 61 observations and 14 actions, with a 64 MiB file limit. A policy can be published on the Hub with a model card and training configuration so others can reproduce the result.

## What it means

Microduck will not replace a warehouse robot: 800 grams of payload will not move even a heavy box. The value lies elsewhere — in a documented, published pipeline. Simulation, a realistic actuator model, domain randomisation, ONNX export, deployment to hardware and a public arena for comparison are the same steps teams training full-size humanoids go through. Only the cost of failure differs.

When such a loop costs $399 and a few hours on a workstation, gait hypotheses can be tested before there is a budget for hardware. That is why the demonstration matters more than the robot itself: it shows that sim-to-real is no longer a privilege of labs with their own GPU fleet.

Source: https://huggingface.co/blog/nvidia/microduck-isaac-lab-sim-to-real
