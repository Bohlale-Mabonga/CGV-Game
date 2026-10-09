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

8. **Full rebuild (`Cooked` branch).** The game was restructured into an engine/game/ui architecture:
   - **Systems:** physics, adaptive procedural audio, procedural textures, a post-processing pipeline, 13 custom shaders.
   - **Player:** first- and third-person cameras, a minimap, the hierarchical SPARK robot.
   - **Levels:** all three rebuilt with new mechanics (UV-ink puzzle, sentry stealth, junction-order puzzle with a signal-memory diagnostic, routing grid, fire chase, double-jump, the core finale).
   - **UI:** menus, options, pause/restart, hints, ranks.
9. **Testing pass.** Automated browser tests in Chrome covered all three levels, controls, the level flows and memory. Visual and performance bugs were fixed (see [Bug Tracker](/testing/bug-tracker/)).
10. **Blender robot.** SPARK is modelled by a Blender Python script and loaded as `.glb`.
11. **Trailer** rendered from in-engine footage and uploaded to YouTube (see [Trailer](/media/trailer/)).
12. **Deployed** to the department LAMP server: https://wmc.ms.wits.ac.za/students/sgroup3906/

## Known Issues Fixed Along the Way
- Corridor and objects rendered as a blank black scene due to light intensity values being too low for this Three.js version's physically-based lighting fixed by significantly increasing spotlight/ambient intensity values.
