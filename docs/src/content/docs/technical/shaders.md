---
title: Shaders
---

# Custom Shaders

All shaders are hand-written GLSL in `src/shaders/`. Most use a shared 3D simplex noise `snoise()` and `fbm()` (four layers of noise at increasing detail) from `noise.glsl.js`. The noise function is adapted from webgl-noise by Ashima Arts and Stefan Gustavson (MIT licence) and credited in-game.

## Quick reference

- **Vertex shader:** runs once per vertex; decides *where* it is drawn (`gl_Position`).
- **Fragment shader:** runs once per pixel; decides its colour.
- **Uniform:** the same value for the whole draw, set from JavaScript every frame. This is how **game state drives the effects**.
- **Attribute:** a value per vertex (`position`, `normal`, or our custom `aSeed`).
- **Varying:** a value passed from the vertex shader to the fragment shader, blended across each triangle (e.g. `vPosW`, the world position).

## All shaders

| # | Shader | Used for | Vertex stage | Fragment stage | Driven by |
|---|---|---|---|---|---|
| 1 | Reactor core | Level 3 core, menu | Pushes vertices out along their normals with two layers of animated noise | Swirling plasma, bright veins, a glowing edge | `uInstability` (timer and pylons), `uSealed` |
| 2 | Corona | Halo around the core | Pass-through | Glow fading outward from the core's edge | instability, sealed |
| 3 | Hologram | Keycards, pads, lifts, pylon beams | Random "glitch" slices that shift sideways | Glowing edge, scanlines, flicker | `uTime`, `uOpacity` |
| 4 | UV ink | Level 1 hidden door code | Pass-through | **Reproduces the flashlight's cone test**: visible only inside the beam | Flashlight position, direction, cone angles, on/off |
| 5 | Steam | Every steam vent | **GPU particles**: position computed from the `aSeed` attribute and time | Soft round sprite with fade | `uBurst` (the vent's state) |
| 6 | Scanner beam | Level 2 sentry | Pass-through | Fake volumetric wedge: bright edges, sweeping rings, dust | `uAlert` (detection) |
| 7 | Energy flow | Level 2 cables | Pass-through | Pulses travel along the cable up to the current progress | `uProgress`, `uError` |
| 8 | Force field | Level 2 lift barrier | Pass-through | Hexagon grid, ripple where touched, dissolves when powered down | `uImpactPos/Time`, `uOpacity` |
| 9 | Lava | Level 3 pits | Ripples the surface | Flowing crust with glowing cracks | `uTime`, `uHeat` |
| 10 | Nebula sky | Level 2 dome (animated skybox) | Pins the sphere to the far plane | Procedural nebula, twinkling stars, lit planet | `uSpin`, `uAlarm` |
| 11 | Fire wall | Level 3 chase, plasma flares | Billows the sheet toward you | Rising flames coloured from red to white-hot | `uTime`, `uIntensity` |
| 12 | Scan pulse | Q scanner | Pass-through | Expanding glowing ring that fades | `uProgress` |
| 13 | Dissolve | Falling debris | Passes object position (injected) | Discards pixels below a noise threshold; glowing ember edge | `uDissolve` |
| + | Station FX (post-process) | Whole screen | Full-screen quad | Heat haze, colour fringing, damage flash, glitch, grain, vignette, letterbox, fade | Heat, damage, reboot, level tint |

## Reactor core, in detail (`reactorCore.js`)

**Vertex stage:**
```glsl
float n1 = snoise(normal * 1.6 + vec3(0.0, uTime * 0.6 * speed, 0.0));
float n2 = snoise(normal * 4.2 - vec3(uTime * 1.1 * speed));
float amplitude = mix(0.07 + 0.26 * uInstability, 0.03, uSealed);
vec3 displaced = position + normal * (n1 * 0.65 + n2 * 0.35) * amplitude;
```
- Reads noise using the normal as a 3D coordinate. Adding time makes the pattern flow.
- `n1` gives big, slow bulges; `n2` gives fine, fast ripples.
- Each vertex is pushed along its normal (vertex displacement). Higher instability means a bigger push.

**Fragment stage:**
- **Fresnel:** `1 − dot(normal, view)` makes the silhouette glow.
- **Domain warping:** `fbm(q + warp)`, where `warp` is itself noise, turns blotches into swirling plasma (technique from Inigo Quilez).
- **Veins:** `pow(1 − |snoise|, 7)` gives thin, white-hot lines.
- **Heartbeat:** a pulse that beats faster as instability rises.
- **Seal:** `mix(hot, cool, uSealed)` turns orange into blue.

**Game state:** every frame, `level3.js` sets instability from the time used and the pylons online. Sealing ramps `uSealed` from 0 to 1 over 2.5 s.

## UV ink, in detail (`effects.js`)

```glsl
vec3 toFrag = vPosW - uLightPos;
float cosAngle = dot(normalize(toFrag), normalize(uLightDir));
float cone = smoothstep(uCosOuter, uCosInner, cosAngle);
float reveal = clamp(cone * atten * uLightOn * 3.0, 0.0, 1.0);
gl_FragColor = vec4(uColor * 2.4 * a, a);   // a = paint alpha × reveal × shimmer
```
- The same cone test as a SpotLight, so the code appears exactly where the real beam lands.
- The material uses additive blending, `depthWrite: false`, and `polygonOffset` so it doesn't flicker against the wall.
- **Game state:** every frame, `level1.js` copies in the flashlight's world position, the look direction, the cone angles and whether it's on.

## Steam particles, in detail (`effects.js`)

```glsl
attribute vec4 aSeed;                       // angle, radius, speed, phase (random, set once)
float t = fract(uTime * aSeed.z + aSeed.w); // each particle's looping age, 0 → 1
vec3 p = dir * t * uLength * reach
       + (side * cos(aSeed.x) + up2 * sin(aSeed.x)) * aSeed.y * uSpread * (0.15 + t * 1.3);
gl_PointSize = uSize * (0.3 + t * 1.3) * uPixelRatio * (140.0 / max(0.5, -mv.z));
vAlpha = (1.0 - t) * smoothstep(0.0, 0.15, t) * mix(0.03, 0.5, uBurst);
```
- Each particle's motion is computed on the GPU from its random seed, so the CPU uploads nothing per frame.
- The geometry gets a manual bounding sphere so three.js doesn't wrongly cull it.
- The fragment shader samples a soft dot at `gl_PointCoord` and discards nearly invisible pixels.

## Dissolve (`applyDissolve` in `effects.js`)

This one hooks into a built-in `MeshStandardMaterial` using `onBeforeCompile`. It injects a noise threshold test (`discard`) and an emissive ember edge, so debris keeps full PBR lighting while it burns away.
