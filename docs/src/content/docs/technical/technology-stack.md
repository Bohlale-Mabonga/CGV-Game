---
title: Technology Stack
---

# Technology Stack

| Technology | Used for |
|---|---|
| **Three.js r185** | Scene graph, rendering, lights, materials, shadows |
| **Three.js add-ons** | Post-processing (EffectComposer, UnrealBloomPass, ShaderPass, OutputPass), the mirror floor (Reflector), RoundedBoxGeometry, GLTFLoader, merging geometry (BufferGeometryUtils), lighting environment (RoomEnvironment) |
| **GLSL** | 13 custom shader materials and a post-processing shader |
| **JavaScript (ES modules)** | All game logic |
| **Web Audio API** | Procedural music and sound effects (no audio files) |
| **Web Speech API** | ARIA's voice |
| **Vite** | Dev server and production build (`base: './'` for hosting in a sub-folder) |
| **Fontsource** | Bundled Orbitron and Rajdhani fonts (no CDN at runtime) |
| **Blender 5.2** | The SPARK robot model, built from a Python script and exported as `.glb` |
| **Git & GitHub** | Version control; feature branches |

No physics engine or game framework is used. Physics, collision, the cameras, audio and UI are all written by the team.
