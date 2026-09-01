---
title: "Level 3 — Meltdown (Escape)"
---

# Level 3 — Meltdown (Escape)

## Objective

Reach the reactor core and seal it before a 45-second meltdown timer expires, while the corridor collapses around the player.

## Mechanics

- **Collapsing corridor chunks** — ceiling sections that fall on individual delay timers once the player enters the level. A fallen chunk blocks the path; touching one returns the player to the Level 3 checkpoint and restarts the collapse sequence.
- **Reactor core** — a glowing sphere driven by a custom GLSL shader (see [Technical Documentation](/technical/scene-design/)) that pulses and shifts colour over time.
- **Meltdown timer** — a 45-second countdown displayed on the HUD. Reaching the core in time triggers `reactorCore.userData.seal()`, changing the core's colours to blue/cyan and ending the game as a win. If the timer reaches zero first, the game ends as a loss ("Meltdown — station lost").
