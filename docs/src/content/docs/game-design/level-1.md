---
title: "Level 1 — Corridors (Explore)"
---

# Level 1 — Corridors (Explore)

**What only this level has:** darkness and flashlight management, a door code hidden in UV ink that only the flashlight reveals, a keypad puzzle, and the scanner.

## Objective

Find the three reactor keycards (red, blue, gold), insert them at the card reader beside the Reactor Access door, then take the service lift down.

## Layout

| Area | What happens there |
|---|---|
| Maintenance Dock | Start point: SPARK's charging pod, a window onto space (the static skybox) |
| Main corridor | Two pairs of floor steam vents, and a chest-height steam leak you must **crouch** under |
| Crew Quarters | The **red keycard** on a desk, plus Mira's log hinting that she painted the coolant door code in UV ink above her bunk |
| Storage Bay (8 m tall) | **Blue keycard** at the top. Climb crates, jump a collapsed section of catwalk, and time a steam vent |
| Reactor Access Hall | Card reader, the keypad-locked coolant door, and a rotating amber beacon |
| Coolant Pumps | **Gold keycard** at the far end, behind three rows of steam vents. Each row has a gap lit in green; the gaps alternate sides, so the safe route zigzags between rows |

## Mechanics

- **Flashlight:** a SpotLight that casts shadows, mounted at the robot's head and pointing where you look. Its battery drains while on (0.9 %/s) and recharges while off; it flickers when low. Batteries are also scattered around.
- **UV ink:** the coolant door code is random each run. A custom shader draws it only where the flashlight cone actually falls (see [Shaders](/technical/shaders/)).
- **Keypad:** a mouse-driven popup. A wrong code shakes and buzzes.
- **Steam vents:** cycle idle → 1 s warning hiss and orange glow → scalding burst. In the Coolant Pumps the rows fire in a rolling wave, but the green-lit gaps and the strips between rows are always safe; confident players can time a straight dash instead.
- **Scanner (Q):** a pulse that reveals keycards, logs and pickups through walls.
- **Data logs:** 4 terminals that tell the story and hint at puzzles.
