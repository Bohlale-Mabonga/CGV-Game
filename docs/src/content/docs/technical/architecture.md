---
title: Architecture
---

# Architecture

`src/main.js` is the entry point: it builds the scene, camera, and renderer, constructs each level's objects, wires systems together, and runs the animation loop. Everything else is organised by responsibility:

```
src/
  main.js
  player/
    controls.js            # movement + mouse look
    interaction-system.js  # proximity/E-key interaction handling
  world/
    corridor.js            # Level 1 corridor geometry
    control-room.js         # Level 2 room geometry
    interactables.js        # keycards, door
    power-puzzle.js          # junctions + reactor console (Level 2)
    security-beam.js         # sweeping beam (Level 2)
    steam-vent.js             # Level 1 hazard
    collapse-sequence.js      # Level 3 collapsing chunks
    reactor-core.js            
  lights/
    flashlight.js            # camera-mounted spotlight
  game/
    objectives.js             # ObjectiveTracker (Level 1)
    level2-timer.js            # reusable countdown timer (used by Levels 2 & 3)
  ui/
    hud.js                     # on-screen objective/timer/message display
```

## Update Loop

Every frame, `main.js`'s `animate()` function calls each system's `update(delta)`: player movement, interaction checks, steam vent and security beam animation/hit checks, the power puzzle state, the level timers, the HUD, the reactor core shader time uniform, and the collapse sequence. Win/lose conditions for Level 3 are checked inline based on the player's position and the meltdown timer.
