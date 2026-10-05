import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { loadLevelAssets } from "../core/assets.js";
import { buildRooms } from "./rooms.js";
import { buildDoors } from "./doors.js";
import { buildPuzzleGrid } from "./power-puzzle.js";
import { createReactorConsole } from "./level1-props.js";

const GRID_ORIGIN = { x: -1, z: -25.8 };

const PUZZLE_LAYOUT = [
  [
    { type: "corner", rotation: 3 },
    { type: "corner", rotation: 3 },
    { type: "straight", rotation: 1 },
    { type: "corner", rotation: 0 },
    { type: "straight", rotation: 1 },
    { type: "corner", rotation: 0 },
  ],
  [
    { type: "corner", rotation: 1 },
    { type: "corner", rotation: 3 },
    { type: "corner", rotation: 3 },
    { type: "corner", rotation: 0 },
    { type: "straight", rotation: 1 },
    { type: "corner", rotation: 2 },
  ],
];

function cloneProp(gltf, position, { scale = 0.5, rotY = 0 } = {}) {
  const obj = SkeletonUtils.clone(gltf.scene);
  obj.position.copy(position);
  obj.scale.setScalar(scale);
  obj.rotation.y = rotY;
  return obj;
}

export async function buildLevel({ scene, interactionSystem }) {
  const assets = await loadLevelAssets();

  const rooms = buildRooms(scene, assets);
  const doors = buildDoors(scene, assets.door);

  const puzzle = buildPuzzleGrid({
    interactionSystem,
    models: {
      straight: assets.straightTile.scene,
      corner: assets.cornerTile.scene,
    },
    layout: PUZZLE_LAYOUT,
    originX: GRID_ORIGIN.x,
    originZ: GRID_ORIGIN.z,
    tileSize: 0.5,
    // battery sits west of the first tile, containment input north of the last one
    source: { row: 0, col: 0, side: "W" },
    target: { row: 1, col: 5, side: "N" },
  });

  const auxPower = cloneProp(
    assets.battery,
    new THREE.Vector3(GRID_ORIGIN.x - 0.5, 0.4, GRID_ORIGIN.z),
    { rotY: Math.PI / 2 },
  );
  const containmentInput = cloneProp(
    assets.containment,
    new THREE.Vector3(GRID_ORIGIN.x + 2.5, 0.38, GRID_ORIGIN.z - 1),
  );
  const emitterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c0f0f,
    emissive: 0xff3344,
    emissiveIntensity: 0.8,
  });
  const emitter = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    emitterMaterial,
  );
  emitter.position.set(GRID_ORIGIN.x + 2.5, 0.38, GRID_ORIGIN.z - 0.9);
  const reactorConsole = createReactorConsole(new THREE.Vector3(0, 0.9, -24));
  scene.add(auxPower, containmentInput, emitter, reactorConsole);

  return {
    rooms,
    doors,
    puzzle,
    reactorConsole,
    collisionObjects: doors.all.map((d) => d.object),
    isInside: (x, z) => rooms.some((r) => r.contains(x, z)),
    update(delta) {
      for (const d of doors.all) d.mixer.update(delta);

      if (puzzle.isSolved()) {
        emitterMaterial.emissive.setHex(0x33ff33);
        emitterMaterial.emissiveIntensity = 1;
      } else {
        emitterMaterial.emissive.setHex(0xff3344);
        const t = performance.now() * 0.01;
        const flicker = Math.abs(Math.sin(t) * 0.6 + Math.sin(t * 2.1) * 0.4);
        emitterMaterial.emissiveIntensity = 0.3 + 0.5 * flicker;
      }
    },
  };
}
