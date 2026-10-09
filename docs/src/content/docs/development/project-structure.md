---
title: Project Structure
---

# Project Structure

The current game lives on the **`Cooked`** branch.

```
CGV-Game/
  index.html              entry page (relative paths only)
  package.json
  vite.config.js          base: './' for sub-folder hosting
  public/
    favicon.svg
    assets/models/spark-robot.glb     Blender-built robot
  src/
    main.js
    style.css
    engine/               renderer, physics, input, audio, textures, settings
    shaders/              GLSL shaders (see Technical → Shaders)
    game/                 game.js, player.js, robot.js, level.js
      levels/             level1.js, level2.js, level3.js
      objects/            common.js (doors, keycards, vents, terminals, pickups)
    ui/                   ui.js (menus/HUD/modals), credits.js
    trailer/              director.js (?trailer capture mode)
  tools/
    blender/              build_spark.py, spark-preview.png
    trailer/              capture script, narration lines, TTS script, README
  docs/                   this documentation site (Astro Starlight; docs branch)
```

For what each module does, see [Architecture](/technical/architecture/).
