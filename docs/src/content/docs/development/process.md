---
title: Development Process
---

# Development Process

## Milestones So Far

1. Repository, Vite, and Three.js scaffolding set up, confirmed a basic scene renders and the dev/build pipeline works end to end.
2. Game concept finalised as a group (Core Breach, chosen from 8 pitched ideas via anonymous vote).
3. Roles assigned across six focus areas: mechanics/puzzles, graphics/shaders, testing/documentation, levels/movement, lighting/environment, and general integration.
4. First-person movement and mouse-look implemented.
5. Level 1 built: flashlight, keycards, steam vents, locked/unlockable door, objective tracking, HUD.
6. Level 2 built: control room, power-junction puzzle with a correct sequence, security beam hazard, countdown timer.
7. Level 3 built: collapsing corridor sequence, custom-shader reactor core, meltdown timer, win/lose conditions.

## Known Issues Fixed Along the Way
- Corridor and objects rendered as a blank black scene due to light intensity values being too low for this Three.js version's physically-based lighting fixed by significantly increasing spotlight/ambient intensity values.
