---
title: Collision & Interaction Ranges
---

# Collision & Interaction Ranges

No physics engine is used. Instead, simpler distance-based checks handle all collision-like behaviour:

- **Movement bounds** — `PlayerControls.setBounds()` clamps the camera's X/Z position to a fixed rectangle per level, preventing the player from walking through corridor walls or off the playable area.
- **Interaction range** — `InteractionSystem` checks the distance from the camera to every registered interactable each frame; keycards auto-collect within range, while doors and power junctions become the "nearest interactable" (triggerable with `E`) within range.
- **Hazard hit detection** — steam vents, the security beam, and collapsed corridor chunks each use a flattened (Y-ignored) distance or bounding-box check against the camera's position; a hit resets the player to a fixed checkpoint for that section.
- **Win condition** — reaching the reactor core is a simple distance check (`checkCoreReached`) against a fixed range.

This approach was chosen deliberately over a physics engine: it is far simpler to implement and debug within the project timeline, while still satisfying the course's requirement for a working sense of physicality and consequence.
