---
title: Physics & Collision
---

# Physics & Collision

We wrote our own lightweight physics (`engine/physics.js`) instead of using a physics engine.

## The world

The world is a list of colliders:
- **Boxes:** walls, floors, crates, platforms, doors, pistons. Many are produced automatically by the level builders.
- **Rings:** circular walls and the ring catwalk in Level 2, and the round reactor chamber in Level 3. A ring is tested by distance from its centre, so curved walls collide exactly instead of being approximated with boxes.

Colliders can be switched on and off (doors, force fields, the extending bridge) or moved every frame (pistons, the moving platform).

## The character

SPARK is an upright box: 0.32 m radius, 1.2 m tall standing, 0.72 m crouched.

**Each frame:**
1. Gravity (−24 m/s²) is added to the velocity.
2. Movement is split into small sub-steps, so fast motion (jump pads) can't tunnel through floors.
3. Each sub-step resolves X, then Z, then Y separately against the colliders. This gives clean sliding along walls.

**Stairs and slopes:**
- Obstacles up to 0.45 m high are climbed automatically. This is how staircases work.
- When walking downhill, SPARK snaps down onto the next step instead of bouncing.

**Ring colliders** push the robot out along the radius, toward whichever face of the ring is nearer.

## Movement feel

- **Acceleration-based movement:**
  - Walk 4.3 m/s, sprint 7 m/s, crouch 2.1 m/s.
  - Fast acceleration on the ground, little control in the air.
- **Jumping:**
  - Jump speed 8.2 m/s (about 1.4 m high).
  - **Coyote time** (0.12 s): you can still jump just after leaving a ledge.
  - **Jump buffering** (0.14 s): a jump pressed just before landing still counts.
- **Double-jump** (Level 3): 8.0 m/s.
- **Jump pads:** set the velocity directly. Air drag is reduced briefly so the robot keeps its momentum.
- **Hits:** knock you back in the direction away from the hazard.

## Other uses

- **Raycasts** (slab method against boxes):
  - The third-person camera pulls in when a wall is in the way.
  - The Level 2 sentry checks line of sight, so pillars give real cover.
- **Hazard checks:**
  - Steam: a cylinder test against several points up the robot's body.
  - Debris and flares: distance from their landing point.
  - Pistons: overlap with the piston head.
  - Lava: falling below a set height.
