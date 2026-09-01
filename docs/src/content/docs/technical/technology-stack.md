---
title: Technology Stack
---

# Technology Stack

- **Three.js** — 3D scene graph, rendering, lighting, and materials
- **Vite** — development server and production bundler
- **JavaScript (ES modules)** — game logic, organised into small single-responsibility modules
- **WebGL** — underlying rendering API used by Three.js
- **GLSL** — custom vertex/fragment shader for the reactor core
- **Git & GitHub** — version control, feature-branch workflow

No physics engine or external game framework is used — movement bounds, collisions, and interaction ranges are implemented directly using distance checks and manual clamping.