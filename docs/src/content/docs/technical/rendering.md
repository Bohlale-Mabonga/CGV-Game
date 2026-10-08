---
title: Rendering & Effects
---

# Rendering & 3D Effects

## Post-processing chain (`engine/renderer.js`)

```
RenderPass   → multisampled HDR render target (MSAA anti-aliasing)
UnrealBloom  → glow on emissive surfaces and the core
StationFX    → our custom full-screen shader (heat haze, damage, glitch, grade…)
OutputPass   → ACES tone mapping + sRGB
```

After that, the minimap is drawn into the top-right corner with a second, orthographic camera.

## Rubric effects and where to find them

| Effect | Where |
|---|---|
| Anti-aliasing | 4× MSAA on the composer's render target (High), 2× (Medium) |
| Depth tests | Transparent holograms and particles use `depthWrite: false`; UV ink uses `polygonOffset`; the sky is pinned to the far plane |
| Multiple light sources | See [Lighting](/technical/lighting/) |
| Flat and smooth shading | The robot's wheel and debris use `flatShading`; most other surfaces are smooth |
| Curves | Power cables follow `CatmullRomCurve3` curves (`TubeGeometry`); intro fly-throughs follow curved camera paths |
| Surfaces | `LatheGeometry` reactor housing; dome; tori; capsule tanks |
| Static skybox | A procedural star cube map (Levels 1 and 3), seen through the dock window and the broken ceiling |
| Dynamic skybox | The animated nebula shader (Level 2) |
| Shadows | Flashlight and starlight shadow maps |
| Reflections | Real-time mirror floor (`Reflector`, High quality); environment-map reflections on metal and glass |
| Textures beyond colour | Normal, roughness, bump, **displacement**, alpha and emissive maps (below) |

## Procedural textures (`engine/textures.js`)

Every texture is generated on a canvas at load time.
1. A **height map** is drawn first: panel seams, rivets, vents, diamond tread, rock.
2. A Sobel filter turns the height map into a **normal map**, so the lighting lines up exactly with the painted detail.
3. The same height and grime data produce the **colour** and **roughness** maps.

| Texture set | Maps |
|---|---|
| Wall panels | colour, normal, roughness |
| Diamond floor plate | colour, normal, roughness |
| Ceiling grilles | colour, normal, emissive |
| Hazard stripes | colour, normal |
| Scorched rubble (Level 3) | colour, normal, **displacement**, emissive cracks, roughness |
| Brushed metal | bump |
| Catwalk grate | alpha (cut-out), normal |
| Star field | 6-face cube map |

The Level 3 walls are finely subdivided planes with a **displacement map**, so the rock surface is genuinely bumpy, not just painted to look bumpy.

UVs are scaled to world size (`worldBox`), so every wall has the same texture density whatever its size.

## Quality presets

| | Low | Medium | High (default) |
|---|---|---|---|
| Resolution (pixel ratio) | 0.75 | 1.0 | up to 1.5 |
| MSAA | off | 2× | 4× |
| Bloom | off | on | on |
| Shadow maps | 512² | 1024² | 1024² |
| Mirror floor | off | off | on |

On top of the preset, **automatic resolution scaling** lowers the resolution (down to 60 %) if the frame rate drops below 48 FPS, and raises it again when there's headroom.
