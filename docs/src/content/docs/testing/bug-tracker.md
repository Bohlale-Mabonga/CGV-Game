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
| Lava fall reset integrity to full | Respawning always restored health | Only a full reboot restores integrity | Fixed |
