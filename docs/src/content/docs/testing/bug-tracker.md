---
title: Bug Tracker
---

# Bug Tracker

Bugs found during the automated testing pass, and how each was fixed.

| Bug | Cause | Fix | Status |
|---|---|---|---|
| Stutter when toggling the flashlight | Toggling a light's `visible` changes the light count, so every material recompiles | Fade the intensity instead | Fixed |
| Idle steam vents looked like huge white blobs | Particle size and opacity too large | Smaller particles; much lower idle opacity | Fixed |
| First-person arms looked like giant tubes | Arms too big and too close to the camera | Scaled down and repositioned | Fixed |
| Top bunk hid half the UV-ink code | Bunk placed under the ink | Removed that bunk | Fixed |
| Blinding glare from the hall beacon | Emissive dome far too bright | Smaller, dimmer dome | Fixed |
| Level 1 too dark; too much film grain | Weak flashlight and fill light; grain 0.03 | Flashlight 60 → 110, brighter hemisphere light, grain 0.012 | Fixed |
| Minimap stayed visible behind result screens | The minimap was only cleared during HUD updates | Cleared whenever not playing | Fixed |
| Level 2 at 34 FPS | Sky shader ran on every pixel; full-res mirror floor | Draw the sky last; mirror at 32 % resolution | Fixed (about 42 FPS, plus auto scaling) |
| Over-bright overhead lights and pickup halos in Level 2 | Intensities too high | Toned down | Fixed |
| Reactor core rendered as a white blob | Shader output too hot for the bloom threshold | Rebalanced the core's brightness; bloom threshold raised to 1.0 | Fixed |
| Menu robot invisible | The menu cloned the player's model while it was hidden for first-person view | Set the clone visible | Fixed |
| Menu title clipped | Font too large | Title size reduced | Fixed |
| Fire wall blown out to white | Fire shader too bright | Rebalanced the fire's brightness | Fixed |
| Pointer-lock refusal opened the pause menu | A lock error was treated as the player pressing Esc | Show "Click to resume" instead | Fixed |
| Pistons could lift the robot onto their tops | The physics resolved overlap upward while a piston descended | Piston colliders only solid when fully up or down; crush check handles contact | Fixed |
| Gap between the Level 3 corridor and the chamber | Corridor ended 1 m short of the chamber wall | Extended the corridor | Fixed |
| Lava fall reset health to full | Respawning always restored health | Only a full reboot restores health | Fixed |
| No clear way past the Coolant Pumps vents (playtest feedback) | Four wall-to-wall curtains with no gaps and no safe space between them | Three rows, each with a green-lit gap on alternating sides, and 1.1 m safe strips between rows. Tested: zigzag route takes 0 hits; a straight dash without timing still gets hit | Fixed |
| "Integrity" was unclear to players (playtest feedback) | Technical term for health | Renamed to "Health" in the HUD, the warning and pickup messages | Fixed |
| Log 02 temperature in kelvin (playtest feedback) | Unfamiliar unit | Now shown in °C (2,527 °C) | Fixed |
| Refraction listed in the rubric but missing from the game (rubric review) | Only reflections had been implemented | Glass tanks were tried and rejected (too bright). The dock window is now curved glass that refracts the star skybox (cube-map refraction). No measurable frame-rate cost | Fixed |
| Mixed kW/MW/GW junction loads were confusing (playtest feedback) | Unit conversion added difficulty without adding fun | All loads in MW. Junction readings are now revealed by winning the new load-diagnostic minigame, which also shows the order | Changed |
