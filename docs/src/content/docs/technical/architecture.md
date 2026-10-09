---
title: Architecture
---

# Architecture

`src/main.js` boots everything:
1. Creates the renderer (`Engine`), the UI and input.
2. Generates assets behind the loading screen (`game.init`).
3. Shows the main menu.
4. Starts the frame loop: each frame calls `game.update(dt)`, `engine.render()` and `engine.adapt(dt)`.

If the URL contains `?trailer`, the trailer director takes over the frame loop instead (see [Trailer](/media/trailer/)).

```
src/
  main.js                 entry point and frame loop
  style.css               UI styling and colour scheme
  engine/
    renderer.js           renderer, post-processing chain, quality presets, auto resolution, minimap viewport
    physics.js            box and ring colliders, character controller, raycasts
    input.js              keyboard/mouse state, pointer lock
    audio.js              procedural music sequencer, sound effects, 3D sound, ARIA voice
    textures.js           procedural canvas textures (colour, normal, roughness, displacement…)
    settings.js           options and progress saved in localStorage
  shaders/
    noise.glsl.js         shared simplex noise and fBm
    reactorCore.js        reactor core and corona shaders
    effects.js            hologram, UV ink, steam, scanner, energy flow, force field,
                          lava, nebula sky, fire wall, scan pulse, dissolve
    postfx.js             full-screen Station FX post-process shader
  game/
    game.js               state machine, level loading, interaction, scanner, hints, minimap, stats
    player.js             movement, cameras, flashlight, health/stamina/battery
    robot.js              SPARK model (procedural fallback + Blender .glb) and its animation
    level.js              Level base class: builder helpers, geometry merging, dispose()
    levels/level1.js      Corridors
    levels/level2.js      Control Room
    levels/level3.js      Meltdown
    objects/common.js     Door, Keycard, SteamVent, Terminal, Pickup, signs
  ui/
    ui.js                 menus, HUD, modals (keypad, routing grid, logs), results screens
    credits.js            credits screen data
  trailer/
    director.js           scripted trailer camera and capture mode
```

## Game states

The game runs as a state machine: `menu` → `loading` → `intro` (level fly-through) → `playing`. From `playing` it can move to:
- `paused`
- `modal`: a console is open, but the world keeps running
- `modalPaused`: reading a data log, so the world is frozen
- `dead`: the reboot effect, then respawn
- `levelComplete`, `gameOver` or `victory`

## Levels

Each level is a class that extends `Level`:
- `build()` creates its geometry, lights and objects.
- `start()` runs when play begins.
- `update(dt)` runs the game logic each frame.
- `hints()` and `objectiveText()` feed the HUD.
- `dispose()` frees everything when the level unloads.

Only one level is in memory at a time. When a level loads:
1. The previous level is disposed and the physics world cleared.
2. The new level is built.
3. All its shaders are pre-compiled (`renderer.compileAsync`), so the first frames don't stutter.
