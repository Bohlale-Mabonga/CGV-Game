---
title: Project Structure
---

# Project Structure

```
CGV-Game/
  index.html
  package.json
  vite.config.js
  src/
    main.js
    style.css
    player/
      controls.js
      interaction-system.js
    world/
      corridor.js
      control-room.js
      interactables.js
      power-puzzle.js
      security-beam.js
      steam-vent.js
      collapse-sequence.js
      reactor-core.js
    lights/
      flashlight.js
    game/
      objectives.js
      level2-timer.js
    ui/
      hud.js
```

Each folder groups files by responsibility (player systems, world objects, lighting, game-state, UI) rather than by level, since several systems (the timer, the interaction system, movement) are shared across more than one level.
