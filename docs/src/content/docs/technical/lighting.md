---
title: Lighting
---

# Lighting

Every level uses several light types, each tuned to that level's mood. The lights use Three.js's physically based units, so intensities are high numbers (e.g. 110 for the flashlight).

| Light | Type | Where | Purpose |
|---|---|---|---|
| Flashlight | `SpotLight`, **casts shadows** | All levels | Mounted at SPARK's head, aimed where you look; limited by its battery |
| Fill light | `PointLight` | Follows SPARK | Faint light so the area around SPARK is never pitch black |
| Hemisphere | `HemisphereLight` | Every level | Sky/ground ambient light, tinted per level |
| Emergency lights | `PointLight` | Level 1 | Red and amber lights that flicker randomly |
| Rotating beacon | `SpotLight` in a rotating group | Level 1 hall, Level 3 corridor | A beam that sweeps the room |
| Light shaft | `SpotLight` | Level 1 Storage Bay | Cold light falling from a ceiling hatch |
| Starlight | `DirectionalLight`, **casts shadows** | Level 2 | Light through the dome, casting shadows of the pillars and turret |
| Accent spots | `SpotLight` | Level 2 | Pools of light around the room |
| Sentry light | `SpotLight` in the turret | Level 2 | Sweeps with the scanner beam; turns red as it detects you |
| Lava glow | `PointLight` | Level 3 | Orange light from below the pit |
| Fire wall | `PointLight` attached to the fire | Level 3 | Moves with the chase |
| Reactor core | `PointLight` | Level 3 | Pulses with instability; shifts from orange to blue when sealed |

## Things we learned

- **Never toggle a light's `visible` flag during play.** Three.js builds its shaders around the number of lights, so changing it forces every material to recompile, which causes a visible stutter. Lights are faded by intensity instead.
- **Glow without lights:** many glowing things (signs, strips, holograms) use emissive materials plus bloom rather than real lights. This keeps the light count, and the cost per pixel, low.
- **Only two shadow-casting lights at a time:** the flashlight, plus the starlight in Level 2. Shadow maps are 1024² (512² on Low quality).
