---
title: Scene Design
---

# Scene Design

## Hierarchical Modelling

Every major object in the game is built as a `THREE.Group` with meshes and lights added as children, rather than as separate unrelated objects. This is deliberate: a group's children always move and rotate together with their parent, which both simplifies the code and directly demonstrates the hierarchical modelling concept required by the course.

Examples:
- **Corridor segments** (`createCorridorSegment`) — floor, ceiling, and both walls are children of one group, since they always move together as one physical section of the station.
- **Keycards** — the visible card mesh and its point light are children of one group, so the light always follows the card as it rotates and bobs.
- **Power junctions** — panel mesh, clue light, and clue marker sphere are grouped together so a single junction can be positioned, coloured, and swapped between materials as one unit.
- **Reactor core** — the shader-driven sphere and its point light are grouped so the light intensity and the shader can be animated together in `update()`.
- **Flashlight** — parented directly to the camera object itself (`camera.add(light)`), so it inherits the camera's position and rotation automatically with no manual syncing required.

## The Custom Shader (Reactor Core)

The reactor core uses a `THREE.ShaderMaterial` with a custom vertex and fragment shader, rather than a built-in material:

- **Vertex shader** — computes the surface normal in view space (`vNormal`) and passes it to the fragment shader; standard positioning otherwise.
- **Fragment shader** — blends between a base colour and a glow colour using `sin(time * 4.0)`, so the colour pulses continuously. It also adds a rim-light effect based on the surface normal, brightening the edges of the sphere relative to the camera.
- The `time` uniform is incremented every frame in `reactorCore.userData.update(delta)`, which is what keeps the pulse animating rather than being a static, one-time colour choice.
- Sealing the core (`seal()`) swaps the `baseColor` and `glowColor` uniforms from red/orange to blue/cyan, visually signalling success.
