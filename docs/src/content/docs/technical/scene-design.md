---
title: Scene Design & Hierarchy
---

# Scene Design & Hierarchical Modelling

Objects are built as parent/child hierarchies, so moving or rotating a parent carries all its children with it. This page lists each main hierarchy and why it is built that way, since markers may ask for exactly that.

## SPARK, the robot (`game/robot.js`)

```
Robot (world position + facing)
└─ Chassis (bob and lean)
   ├─ Wheel (rolls with the distance travelled)
   ├─ Fork
   └─ Torso
      ├─ Backpack ─ NozzleL/R ─ FlameL/R (thruster flames)
      ├─ ShoulderL/R ─ ArmL/R ─ ForearmL/R ─ ClawL/R
      └─ Head (tilts with the camera) ─ Visor, Antenna ─ AntennaTip
```

**Why this structure:**
- **Arms:** swinging a shoulder moves the arm, forearm and claw together.
- **Head:** tilting it carries the visor and antenna.
- **Crouching:** lowering the torso takes the head, arms and thrusters with it.

**The animation code** (`RobotRig`) only rotates a few joints:
- the wheel rolls with the distance travelled;
- the arms swing alternately when walking, and the right arm reaches out when you interact;
- the head tilts to match the camera;
- the antenna wobbles;
- the thruster flames scale up when jumping or boosting;
- the visor changes colour: cyan normally, amber at low health, red when hurt.

The Blender model uses the same node names, so the same code animates it.

## Other hierarchies

| Object | Hierarchy | Why |
|---|---|---|
| Blast door | Door → Frame (pillars, header, status strip) + LeafL/LeafR | The leaves slide apart relative to the frame; the whole door can be placed and rotated as one |
| Security turret | Turret → Pivot (rotates) → Head, Lens, scanner-beam wedge, SpotLight | Rotating the pivot sweeps the head, the beam *and* its light together |
| Junction | Junction → Housing, Screen, Status light, LeverPivot → Handle | The lever rotates about its own pivot; the whole unit is turned to face the room centre |
| Reactor core | Core group → core sphere, corona, RingPivot ×3 → Ring → glow strip | Rings spin independently and then lock into place as pylons come online |
| Keycard | Keycard → card (spins and bobs) + hologram beam + base | The card animates on its own while the base stays still |
| Flashlight | Flashlight rig → SpotLight + target | The rig follows the head in both camera modes, so the beam always comes from SPARK |
| First-person arms | Camera → ViewArms → arm pivots | Objects that move with the camera, as the rubric asks |
| Rotating beacons | Beacon group → dome + SpotLight + target | Rotating the group sweeps the light around the room |

## Objects that move with the world vs. with the camera

- **With the world:** doors, the turret, debris, pistons, the moving platform, the fire wall.
- **With the camera:** the first-person arms. The sky sphere in Level 2 is also moved to the camera's position every frame, so it looks infinitely far away.
