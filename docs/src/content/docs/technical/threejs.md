---
title: Three.js
---

# How we use Three.js

- **Renderer:** WebGL2 with ACES filmic tone mapping and sRGB output. Shadows use PCF shadow maps.
- **Scene graph:** one persistent `Scene` holds the camera, SPARK and the flashlight rig. Each level adds its own `root` group and removes it when unloaded.
- **Materials:**
  - `MeshStandardMaterial`, with procedural texture maps, for most surfaces.
  - `MeshPhysicalMaterial` for glass.
  - `ShaderMaterial` for our custom shaders (see [Shaders](/technical/shaders/)).
  - `onBeforeCompile` to inject our dissolve effect into a built-in material.
- **Geometry:** boxes, cylinders, capsules, spheres, tori, rings, `TubeGeometry` along `CatmullRomCurve3` curves (power cables), `LatheGeometry` (reactor housing), `RoundedBoxGeometry`, `ShapeGeometry` (the minimap arrow) and `Points` (particles).
- **Merging:** static level geometry is merged per material with `mergeGeometries`, so a level is drawn with a few large meshes instead of hundreds of small ones.
- **Environment:** `PMREMGenerator` builds an environment map from `RoomEnvironment`, used for reflections on metal and glass. Its strength is tuned per level.
- **Loading:** `GLTFLoader` loads the Blender robot. If the file is missing, the game falls back to a robot built in code.
- **Post-processing:** an `EffectComposer` chain (see [Rendering & Effects](/technical/rendering/)).
- **Second viewport:** the minimap is rendered with `setViewport`/`setScissor` and an `OrthographicCamera` after the main frame.
