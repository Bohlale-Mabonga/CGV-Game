---
title: Project Overview
---

# Project Overview

**Core Breach** is a 3D browser game built with Three.js for COMS3006A.

You play SPARK, a small maintenance robot left behind on the space station HELIOS-9 after the crew evacuate. The reactor is overheating, and SPARK has to cross three very different parts of the station to reach the core and seal it before it breaches.

- **Play it:** https://wmc.ms.wits.ac.za/students/sgroup3906/
- **Source code:** the `Cooked` branch of the GitHub repository.

## The three levels

| Level | Kind of challenge | What only this level has |
|---|---|---|
| 1 · Corridors | Explore | Darkness, a flashlight with a battery, a door code painted in UV ink that only the flashlight reveals, a keypad, crouching under steam, crate platforming |
| 2 · Control Room | Solve | A countdown, a sentry turret you hide from, a signal-memory minigame that reveals the junction order, junctions to switch on lowest load first, jump pads, a pipe-routing puzzle |
| 3 · Meltdown | Escape | A wall of fire chasing you, falling debris, a lava pit, the thruster double-jump, crushing pistons, the reactor-core finale |

## Highlights

- **Two camera views:** first person (with robot arms attached to the camera) and third person (a camera that pulls in when a wall gets in the way).
- **Minimap:** a picture-in-picture top-down map that turns with the player.
- **Custom shaders:** 13 hand-written GLSL shader materials plus a full-screen post-processing pass. See [Shaders](/technical/shaders/).
- **Physics:** our own character controller with gravity, jumping, crouching, collision, stair climbing and moving platforms. See [Physics & Collision](/technical/collision/).
- **Procedural assets:** every texture is generated in code, and all music and sound is synthesised live in the browser.
- **Blender robot:** SPARK was built in Blender from a Python script. See [3D Models](/technical/models/).
- **Full menus:** main menu, level select, options, pause and restart without reloading the page, plus hints, ranks and best times.
