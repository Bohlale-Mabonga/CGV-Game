---
title: Lighting
---

# Lighting

| Light | Type | Purpose |
|---|---|---|
| Ambient light | `AmbientLight` | Base fill light so nothing is pure black |
| Debug directional light | `DirectionalLight` | Temporary general-purpose light for early scene visibility |
| Flashlight | `SpotLight`, parented to camera | Player's primary light source in Level 1; toggled with `F` |
| Keycard glow | `PointLight`, parented to each keycard | Highlights collectibles, pulses in intensity |
| Control room light | `PointLight` | Blue ambient light for the Level 2 room |
| Junction clue lights | `PointLight` per junction | Colour-codes each junction to hint at the correct order |
| Steam vent warning light | `PointLight` | Colour/intensity changes based on vent active/inactive state |
| Security beam light | `PointLight` | Reinforces the beam's visibility/danger |
| Reactor core light | `PointLight` | Pulses in sync with the shader's colour animation |

A note on light intensity: this project's Three.js version uses physically-based light units, which require much higher numeric values than older tutorials suggest (e.g. a spotlight intensity of `80` rather than `1`–`2`) to be visible at all — this caused an early bug where the corridor rendered as a completely blank/black scene until intensities were corrected.
