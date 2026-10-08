# Builds SPARK, the maintenance robot, in Blender and exports it as a GLB.
#
#   blender -b -P tools/blender/build_spark.py -- <out.glb> [preview.png]
#
# The node names and hierarchy match src/game/robot.js (Robot → Chassis →
# Wheel/Fork/Torso → Head/Shoulders/Backpack …) so the game's RobotRig can
# animate the Blender model exactly like the procedural fallback.
#
# Coordinates in this script are written in three.js space (Y up, robot faces
# -Z) and converted with B(), because the glTF exporter maps Blender Z-up to
# glTF Y-up (Blender (x, y, z) -> glTF (x, z, -y)).

import sys
import math
import bpy
import bmesh

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'spark-robot.glb'
PREVIEW = argv[1] if len(argv) > 1 else None


def B(x, y, z):
    return (x, -z, y)


# ------------------------------------------------------------------ reset --
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


M = {
    'shell': material('Shell', (0.82, 0.79, 0.73), 0.05, 0.42),
    'accent': material('Accent', (1.0, 0.27, 0.02), 0.1, 0.5),
    'metal': material('Metal', (0.04, 0.05, 0.065), 0.85, 0.32),
    'rubber': material('Rubber', (0.012, 0.013, 0.016), 0.0, 0.9),
    'glass': material('VisorGlass', (0.003, 0.005, 0.008), 0.6, 0.08),
    'visor': material('Visor', (0.004, 0.02, 0.03), 0.0, 0.5, (0.04, 0.6, 1.0), 3.2),
    'tip': material('Tip', (0.03, 0.005, 0.0), 0.0, 0.5, (1.0, 0.27, 0.02), 4.0),
    'flame': material('Flame', (0.1, 0.5, 0.9), 0.0, 0.5, (0.25, 0.7, 1.0), 3.0),
}


def empty(name, parent=None, pos=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.05
    scene.collection.objects.link(o)
    if parent:
        o.parent = parent
    o.location = B(*pos)
    return o


def finish(o, name, mat, parent, pos, smooth=True, bevel=0.0, segments=3):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    if bevel > 0:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
        if bevel > 0:
            o.data.shade_smooth() if hasattr(o.data, 'shade_smooth') else None
    o.parent = parent
    o.location = B(*pos)
    return o


def box(name, size, mat, parent, pos, bevel=0.0, smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    sx, sy, sz = size
    o.scale = (sx, sz, sy)  # three (w, h, d) -> blender (x, y=depth, z=height)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, name, mat, parent, pos, smooth, bevel)


def cylinder(name, r1, r2, h, mat, parent, pos, axis='y', verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h)
    o = bpy.context.active_object
    if axis == 'x':
        o.rotation_euler = (0, math.pi / 2, 0)
        bpy.ops.object.transform_apply(rotation=True)
    elif axis == '-y':
        o.rotation_euler = (math.pi, 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
    return finish(o, name, mat, parent, pos)


def sphere(name, r, mat, parent, pos, ico=False, sub=2):
    if ico:
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=sub)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=24, ring_count=14)
    o = bpy.context.active_object
    return finish(o, name, mat, parent, pos, smooth=not ico)


def capsule(name, r, length, mat, parent, pos):
    # Cylinder with hemispherical caps, built as one mesh with bmesh.
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=r)
    for v in bm.verts:
        v.co.z += length / 2 if v.co.z > 0 else -length / 2
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(o)
    return finish(o, name, mat, parent, pos)


# ------------------------------------------------------------- the robot --
robot = empty('Robot')
chassis = empty('Chassis', robot)

wheel = empty('Wheel', chassis, (0, 0.22, 0))
sphere('WheelTyre', 0.22, M['rubber'], wheel, (0, 0, 0), ico=True, sub=2)
cylinder('WheelHub', 0.1, 0.1, 0.46, M['metal'], wheel, (0, 0, 0), axis='x')

fork = empty('Fork', chassis, (0, 0.3, 0))
for side in (-1, 1):
    box(f'ForkPlate{side}', (0.06, 0.3, 0.26), M['accent'], fork, (side * 0.26, 0, 0), bevel=0.02)
    cylinder(f'Axle{side}', 0.04, 0.04, 0.05, M['metal'], fork, (side * 0.29, -0.08, 0), axis='x')
cylinder('Hip', 0.26, 0.22, 0.12, M['metal'], fork, (0, 0.16, 0), verts=32)

torso = empty('Torso', chassis, (0, 0.7, 0))
box('TorsoShell', (0.52, 0.42, 0.38), M['shell'], torso, (0, 0, 0), bevel=0.07)
box('ChestPlate', (0.32, 0.13, 0.03), M['accent'], torso, (0, 0.04, -0.19), bevel=0.01)
for i in range(3):
    box(f'ChestVent{i}', (0.18, 0.012, 0.02), M['metal'], torso, (-0.05, -0.08 - i * 0.03, -0.192))
sphere('ChestLight', 0.03, M['visor'], torso, (0.12, -0.1, -0.185))
for x in (-0.2, 0.2):
    for y in (-0.15, 0.15):
        sphere(f'Bolt{x}{y}', 0.012, M['metal'], torso, (x, y, -0.19))

backpack = empty('Backpack', torso, (0, -0.02, 0.24))
box('Pack', (0.38, 0.32, 0.14), M['metal'], backpack, (0, 0, 0), bevel=0.04)
box('PackStripe', (0.39, 0.05, 0.145), M['accent'], backpack, (0, 0.08, 0))
for side, n in ((-1, 'L'), (1, 'R')):
    nozzle = empty(f'Nozzle{n}', backpack, (side * 0.1, -0.2, 0.02))
    cylinder(f'NozzleBell{n}', 0.045, 0.065, 0.1, M['metal'], nozzle, (0, 0, 0))
    flame = empty(f'Flame{n}', nozzle, (0, -0.24, 0))
    flame.scale = (0.001, 0.001, 0.001)
    cylinder(f'FlameCone{n}', 0.0, 0.06, 0.4, M['flame'], flame, (0, 0, 0), verts=12)

for side, n in ((-1, 'L'), (1, 'R')):
    shoulder = empty(f'Shoulder{n}', torso, (side * 0.31, 0.12, 0))
    sphere(f'ShoulderBall{n}', 0.075, M['metal'], shoulder, (0, 0, 0))
    arm = empty(f'Arm{n}', shoulder, (side * 0.02, -0.02, 0))
    capsule(f'UpperArm{n}', 0.045, 0.16, M['shell'], arm, (0, -0.11, 0))
    forearm = empty(f'Forearm{n}', arm, (0, -0.22, 0))
    sphere(f'Elbow{n}', 0.05, M['metal'], forearm, (0, 0, 0))
    capsule(f'LowerArm{n}', 0.04, 0.14, M['accent'], forearm, (0, -0.1, 0))
    claw = empty(f'Claw{n}', forearm, (0, -0.21, 0))
    for f in (-1, 1):
        finger = box(f'Finger{n}{f}', (0.025, 0.08, 0.04), M['metal'], claw, (f * 0.028, -0.03, 0), bevel=0.006)
        finger.rotation_euler = (0, -f * 0.25, 0)  # splay the claw fingers apart

cylinder('Neck', 0.06, 0.08, 0.1, M['metal'], torso, (0, 0.24, 0))
head = empty('Head', torso, (0, 0.33, 0))
box('HeadShell', (0.42, 0.3, 0.34), M['shell'], head, (0, 0, 0), bevel=0.07)
box('VisorGlass', (0.34, 0.13, 0.04), M['glass'], head, (0, 0, -0.16), bevel=0.015)
visor = empty('Visor', head, (0, 0, -0.183))
for side in (-1, 1):
    box(f'Eye{side}', (0.075, 0.05, 0.012), M['visor'], visor, (side * 0.075, 0, 0), bevel=0.008)
for side in (-1, 1):
    cylinder(f'Ear{side}', 0.07, 0.07, 0.04, M['accent'], head, (side * 0.22, 0, 0.02), axis='x')
    cylinder(f'EarCap{side}', 0.04, 0.04, 0.045, M['metal'], head, (side * 0.225, 0, 0.02), axis='x')
box('HeadStripe', (0.08, 0.31, 0.345), M['accent'], head, (-0.12, 0.0, 0))
antenna = empty('Antenna', head, (0.12, 0.15, 0.06))
cylinder('AntennaStalk', 0.012, 0.008, 0.22, M['metal'], antenna, (0, 0.11, 0), verts=8)
sphere('AntennaTip', 0.025, M['tip'], antenna, (0, 0.23, 0))

# ----------------------------------------------------------------- export --
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
)
print('EXPORTED', OUT)

# --------------------------------------------------------------- preview --
if PREVIEW:
    cam_data = bpy.data.cameras.new('Cam')
    cam = bpy.data.objects.new('Cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (1.4, 2.4, 1.3)  # front three-quarter view (robot faces +Y here)
    target = bpy.data.objects.new('Target', None)
    scene.collection.objects.link(target)
    target.location = (0, 0, 0.6)
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    scene.camera = cam
    for loc, energy in (((2, -2, 3), 600), ((-2, -1, 2), 250), ((0, 2, 2), 300)):
        ld = bpy.data.lights.new('L', 'POINT')
        ld.energy = energy
        lo = bpy.data.objects.new('L', ld)
        lo.location = loc
        scene.collection.objects.link(lo)
    world = bpy.data.worlds.new('W')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.03, 0.05, 1)
    scene.world = world
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', PREVIEW)
