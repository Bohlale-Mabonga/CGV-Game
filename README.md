# Core Breach


| | |
|---|---|
| **Play the game** | https://wmc.ms.wits.ac.za/students/sgroup3906/ |
| **Watch the trailer** | https://www.youtube.com/watch?v=N8VmOEVGrE4 |
| **Documentation** | https://mellifluous-gumdrop-a66f6c.netlify.app/ |
| **Source code** | https://github.com/Bohlale-Mabonga/CGV-Game |

Group project for **COMS3006A — Computer Graphics and Visualisation**, University of the Witwatersrand. 

## Team

- Kuhle Bikitsha
- Thato Chuene
- Ntobeko Mdakane
- Nkosinathi Tshabalala
- Olwethu Makhabane
- Bohlale Mabonga


## Running locally

Requires Node.js.

```bash

npm install
npm run build        # production build into dist/
npm run dev          # development server

```

## Project structure

```
src/
  engine/     renderer & post-processing, physics, input, audio, procedural textures, settings
  shaders/    custom GLSL shaders
  game/       game state, player, robot, levels, interactive objects
  ui/         menus, HUD, popups, credits
  trailer/    scripted trailer capture mode (?trailer)
public/assets/models/   Blender-built robot (.glb)
tools/      Blender script and trailer pipeline
docs/       documentation site (docs branch)
```



## Credits

Every third-party library, font and technique is listed, with sources and licences, on the in-game **Credits** screen (main menu → Credits).



<!-- ## The three levels

| Level | Challenge | What makes it different |
|---|---|---|
| **01 · Corridors** | Explore | The power is out. Use your flashlight to find three keycards, uncover a door code painted in UV ink, and time your way past steam vents |
| **02 · Control Room** | Solve | Win a signal-memory diagnostic to learn the junction order, switch the junctions on lowest load first while hiding from a security sentry, then route the power before the countdown ends |
| **03 · Meltdown** | Escape | Outrun a wall of fire, double-jump across a lava pit with thrusters, dodge crushing pistons, then stabilise and seal the reactor core |

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look (click the game to lock the mouse) |
| Space | Jump (press again mid-air for thrusters in Level 3) |
| Shift | Sprint |
| C | Crouch |
| E / left click | Interact (hold for some objects) |
| F | Flashlight |
| V / mouse wheel | First- or third-person view |
| M | Minimap size |
| H | Hint |
| Esc | Pause menu |

The in-game **How to play** screen covers the basics.

## Features

- **Two cameras:** first person and third person, plus a picture-in-picture minimap that turns with the player.
- **SPARK** is a hierarchical, animated robot model built in **Blender** (from our own Python script).
- **13 custom GLSL shaders** and a post-processing pass, including the boiling reactor core, the flashlight-revealed UV ink, GPU steam particles, the sentry's scanner beam, lava, the nebula sky and the fire wall.
- **Our own physics:** gravity, jumping, crouching, stair climbing, curved-wall collision, moving platforms and jump pads.
- **3D effects:** multi-light scenes, shadows, real-time reflections, static and animated skyboxes, bloom, and generated normal, roughness, bump and displacement maps.
- **Procedural audio:** all music and sound effects are synthesised live, with an adaptive soundtrack, 3D sound and a voiced station AI (ARIA).
- **Menus and extras:** pause, restart without reloading, options, difficulty levels, hints, story logs, ranks and best times.

The [documentation site](https://mellifluous-gumdrop-a66f6c.netlify.app/) explains the design and technical details: shaders, hierarchy, physics, lighting, performance and testing.



## Deploying to the LAMP server

1. Run `npm run build`.
2. Zip the **contents** of `dist/`, so that `index.html` is at the top of the zip.
3. Upload the zip in the group file manager (sgroup3906) and click **UnZip**.
4. Open https://wmc.ms.wits.ac.za/students/sgroup3906/ and play through, with the browser console open, to check for errors.

All paths are relative (`base: './'` in `vite.config.js`), so the game runs from the group's sub-folder. -->
