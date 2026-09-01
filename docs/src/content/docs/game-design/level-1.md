---
title: "Level 1 — Corridors (Explore)"
---

# Level 1 — Corridors (Explore)

## Objective

Collect 3 keycards hidden along a dark corridor, then reach and open the exit door.

## Mechanics

- **Flashlight** — a SpotLight parented to the camera, toggled on/off with `F`. Lights only where the player is looking.
- **Keycards** — glowing, slowly rotating and bobbing objects. Collected automatically by walking within range (no button press). Each collection updates the HUD keycard count.
- **Steam vents** — cycle between active and inactive on a timer (1.5s active / 1.8s inactive). Standing near an active vent returns the player to a checkpoint.
- **Door** — stays closed and locked (brown material) until all 3 keycards are collected, at which point it visually unlocks (turns green) and can be opened with `E`, sliding upward.

## Movement Bounds

The player's position is clamped within corridor bounds (`PlayerControls.setBounds`) to prevent walking through walls or off the level's playable area — a lightweight substitute for full collision detection.