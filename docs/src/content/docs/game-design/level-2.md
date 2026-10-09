---
title: "Level 2 — Control Room (Solve)"
---

# Level 2 — Control Room (Solve)

**What only this level has:** a countdown, a stealth/timing hazard based on line of sight, jump pads, the signal-memory load diagnostic, and the routing grid.

## Objective

Run the **load diagnostic** to find out each junction's load. Then bring the five junctions online from the **lowest load to the highest**, route the power at the master console, and enter the reactor lift once its force field drops. All of this happens before the 4:30 countdown ends (on Normal).

## The room

- A circular, two-tier room under a glass dome. Through the dome you see an animated nebula skybox, drawn by a custom shader.
- The upper ring catwalk is reached by staircases or by the two green jump pads.
- On High quality, the centre of the floor is a real-time mirror.

## Mechanics

- **Load diagnostic (minigame):** the surge has scrambled every junction display ("NO READING"), and the junctions stay locked until you run the diagnostic. Its terminal is near the arrival lift, out of the sentry's reach.
  - It's a **signal-memory test**: four coloured pads flash a sequence and you repeat it with the mouse or the 1–4 keys.
  - There are 3 rounds, of 3, 4 and 5 pulses. A mistake just replays the round, but the clock keeps running.
  - **Winning reveals the order.** The terminal lists the junctions lowest to highest (all in MW), each junction screen shows its load and its place in the order (e.g. "160 MW · #2"), and the HUD objective shows the full order, e.g. *J2 → J3 → J4 → J5 → J1*.
- **Junctions:** 3 on the floor and 2 on the catwalk. Hold E for 1 s to activate one. Loads are random each run.
  - Activating one sends energy flowing along its floor cable to the console.
  - **Wrong order:** a breaker surge (12 damage), all junctions reset, and 10 s off the clock.
- **Security sentry:** a turret in the centre sweeps a wedge-shaped scanner beam across the floor.
  - Standing in the beam *with clear line of sight* fills a detection meter. When it's full, the sentry zaps you (25 damage, −5 s).
  - Grey pillars block its view.
  - It speeds up with every junction you bring online.
- **Arcing conduits:** periodic lightning across two points on the catwalk.
- **Routing grid:** a 5×5 pipe-rotation puzzle at the master console. Click tiles to rotate them and connect the source to the core feed; connected pipes light up. The grid is random each run, and the clock keeps running while you solve it. A shield wall keeps the sentry off you here.
- **Force field:** the lift barrier ripples where you touch it and dissolves once the power is routed.
- **Data logs:** 2 terminals, including the engineer's note pointing to the load diagnostic.
