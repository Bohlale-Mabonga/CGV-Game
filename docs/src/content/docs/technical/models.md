---
title: 3D Models (Blender)
---

# 3D Models

## SPARK, built in Blender

SPARK is modelled in **Blender 5.2** by a Python script, `tools/blender/build_spark.py`. A script means the model can be rebuilt and changed in a repeatable way.

**What the script does:**
- Builds the robot from bevelled cubes, cylinders, spheres and capsules.
- Creates named materials: Shell, Accent, Metal, Rubber, VisorGlass, Visor (emissive), Tip, Flame.
- Builds the same **named hierarchy** the game animates: Robot → Chassis → Wheel / Fork / Torso → Head / Shoulders / Backpack … (see [Scene Design](/technical/scene-design/)).
- Converts coordinates from three.js space (Y up, facing −Z) to Blender's Z-up.
- Exports `public/assets/models/spark-robot.glb` with modifiers applied.
- Renders a preview to `tools/blender/spark-preview.png`.

To rebuild it:
```bash
blender -b -P tools/blender/build_spark.py -- public/assets/models/spark-robot.glb preview.png
```

**In the game:** `GLTFLoader` loads the `.glb`, and `RobotRig` finds the joints by name. If the file can't load, the game uses a code-built robot with the same hierarchy, so nothing breaks.

## Everything else

The rest of the world is built from Three.js geometry in the level builders:
- **Built in code:** doors, keycards, terminals, junctions, the turret, the reactor and its rings, pylons, pickups.
- **Textures:** all procedural (see [Rendering & Effects](/technical/rendering/)).
