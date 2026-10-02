import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const PI = Math.PI;

// halfW/halfD are the walkable half-extents in WORLD axes (after rotation).
const ROOMS = [
  { model: "straight", pos: [0, 0], halfW: 1, halfD: 3 },
  { model: "x", pos: [0, -6], shape: "cross", halfW: 3, halfD: 5, armHalf: 1 },
  { model: "x", pos: [0, -16], shape: "cross", halfW: 3, halfD: 5, armHalf: 1 },
  { model: "office", pos: [-5, -6], halfW: 2, halfD: 2 },
  { model: "office", pos: [5, -6], rot: PI, halfW: 2, halfD: 2 },
  { model: "office", pos: [-5, -16], halfW: 2, halfD: 2 },
  { model: "office", pos: [5, -16], rot: PI, halfW: 2, halfD: 2 },
  // core access room: a stretched office
  {
    model: "coreAccess",
    pos: [0, -24],
    rot: -PI / 2,
    scale: [1.5, 1, 1],
    halfW: 2,
    halfD: 3,
  },
];

function containsPoint(def, x, z) {
  const dx = x - def.pos[0];
  const dz = z - def.pos[1];
  if (def.shape === "cross") {
    return (
      (Math.abs(dx) < def.armHalf && Math.abs(dz) < def.halfD) ||
      (Math.abs(dz) < def.armHalf && Math.abs(dx) < def.halfW)
    );
  }
  return Math.abs(dx) < def.halfW && Math.abs(dz) < def.halfD;
}

export function buildRooms(scene, assets) {
  return ROOMS.map((def) => {
    const object = SkeletonUtils.clone(assets[def.model].scene);
    object.position.set(def.pos[0], 0, def.pos[1]);
    if (def.rot) object.rotation.y = def.rot;
    if (def.scale) object.scale.set(...def.scale);
    scene.add(object);
    return { object, def, contains: (x, z) => containsPoint(def, x, z) };
  });
}
