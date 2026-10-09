---
title: Performance
---

# Performance

The brief warns that the game is marked on lab hardware, so performance was designed in from the start.

## Measures

- **Fewer draw calls:** static geometry is merged per material, so each level draws a handful of large meshes.
- **Nothing created per frame:** the update code reuses temporary vectors.
- **Particles on the GPU:** steam and sparks move in the vertex shader, so the CPU uploads nothing per frame.
- **Light count stays fixed:** lights fade by intensity instead of being switched on and off, which avoids shader recompiles. Emissive materials plus bloom stand in for many real lights.
- **Few shadow casters:** at most two lights cast shadows, with tight shadow cameras.
- **Pre-compiled shaders:** `compileAsync` runs behind the loading fade, so a new level doesn't hitch.
- **Cheap sky:** the nebula sky is drawn *after* the opaque geometry, so its expensive shader only runs on pixels actually visible through the dome.
- **Cheap mirror:** the floor reflection renders at 32 % resolution, and only on High quality.
- **Quality presets and automatic resolution scaling:** see [Rendering & Effects](/technical/rendering/).
- **Small download:** about 1.6 MB in total. Procedural textures and audio mean almost no asset files; fonts are bundled.

## Memory

Each level's `dispose()` walks its scene graph and disposes geometries, materials, textures and render targets. Shared textures are kept for reuse.

We tested this by loading the levels repeatedly. GPU texture and geometry counts returned to the same values every time (e.g. Level 2 always 52 textures, Level 3 always 39), so memory doesn't climb across a playthrough.

## Measured frame rates

Measured on an Intel Iris Xe laptop GPU at 1280×720, High quality:

| Level | FPS |
|---|---|
| Level 1 | 52–56 |
| Level 2 | ~42 before automatic resolution scaling |
| Level 3 | 60 |

Level 2 was originally 34 FPS. Drawing the sky last and lowering the mirror's resolution brought it up.

**Still to do:** confirm the frame rate on a lab machine. Use Chrome's built-in meter: press F12, then Ctrl+Shift+P, type "frame rendering stats" and press Enter.
