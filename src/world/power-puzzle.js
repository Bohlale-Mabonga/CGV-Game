// import * as THREE from 'three';

// let routeProgress = 0;
// const correctRoute = [1, 3, 2];

// const routeColors = {
//     1: 0x37c8ff,
//     3: 0xffd43b,
//     2: 0x37ff8b
// };

// export function createPowerJunction(position, id) {
//     const group = new THREE.Group();
//     group.position.copy(position);

//     const inactiveMaterial = new THREE.MeshStandardMaterial({
//         color: 0x333a44,
//         emissive: 0x000000
//     });

//     const activeMaterial = new THREE.MeshStandardMaterial({
//         color: 0x37ff8b,
//         emissive: 0x0b4a24,
//         emissiveIntensity: 1
//     });

//     const wrongMaterial = new THREE.MeshStandardMaterial({
//         color: 0xff3344,
//         emissive: 0x4a0000,
//         emissiveIntensity: 1
//     });

//     const panel = new THREE.Mesh(
//         new THREE.BoxGeometry(0.7, 0.7, 0.2),
//         inactiveMaterial
//     );
//     group.add(panel);

//     const clueLight = new THREE.PointLight(routeColors[id], 0.8, 2);
//     clueLight.position.set(0, 0.65, 0.1);
//     group.add(clueLight);

//     const clueMarker = new THREE.Mesh(
//         new THREE.SphereGeometry(0.08, 12, 12),
//         new THREE.MeshBasicMaterial({ color: routeColors[id] })
//     );
//     clueMarker.position.set(0, 0.55, 0.12);
//     group.add(clueMarker);

//     group.userData.type = 'junction';
//     group.userData.id = id;
//     group.userData.isActive = false;
//     group.userData.panel = panel;
//     group.userData.inactiveMaterial = inactiveMaterial;
//     group.userData.activeMaterial = activeMaterial;
//     group.userData.wrongMaterial = wrongMaterial;

//     group.userData.onInteract = () => {
//         const expectedId = correctRoute[routeProgress];

//         if (group.userData.id === expectedId) {
//             group.userData.isActive = true;
//             panel.material = activeMaterial;
//             routeProgress++;

//             console.log(`Correct junction ${group.userData.id}`);
//         } else {
//             console.log(`Wrong junction ${group.userData.id} - puzzle reset`);

//             routeProgress = 0;

//             panel.material = wrongMaterial;

//             setTimeout(() => {
//                 panel.material = inactiveMaterial;
//             }, 400);
//         }
//     };

//     group.userData.reset = () => {
//         group.userData.isActive = false;
//         panel.material = inactiveMaterial;
//     };

//     return group;
// }

// export function createReactorConsole(position) {
//     const incompleteMaterial = new THREE.MeshStandardMaterial({
//         color: 0x884444,
//         emissive: 0x220000,
//         emissiveIntensity: 0.5
//     });

//     const completeMaterial = new THREE.MeshStandardMaterial({
//         color: 0x37ff8b,
//         emissive: 0x0b4a24,
//         emissiveIntensity: 1
//     });

//     const mesh = new THREE.Mesh(
//         new THREE.BoxGeometry(1.4, 1, 0.35),
//         incompleteMaterial
//     );

//     mesh.position.copy(position);

//     mesh.userData.type = 'console';
//     mesh.userData.isComplete = false;
//     mesh.userData.incompleteMaterial = incompleteMaterial;
//     mesh.userData.completeMaterial = completeMaterial;

//     mesh.userData.setComplete = () => {
//         if (mesh.userData.isComplete) return;

//         mesh.userData.isComplete = true;
//         mesh.material = completeMaterial;

//         console.log('Power routing puzzle complete');
//     };

//     mesh.userData.reset = () => {
//         mesh.userData.isComplete = false;
//         mesh.material = incompleteMaterial;
//     };

//     return mesh;
// }

// export function updatePowerPuzzle(junctions, consoleMesh) {
//     const puzzleComplete = routeProgress >= correctRoute.length;

//     if (puzzleComplete) {
//         consoleMesh.userData.setComplete();
//     }

//     return puzzleComplete;
// }

// export function resetPowerPuzzle(junctions, consoleMesh) {
//     routeProgress = 0;

//     for (const junction of junctions) {
//         junction.userData.reset();
//     }

//     consoleMesh.userData.reset();
// }

// world/power-puzzle.js
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const TYPES = {
  straight: ["N", "S"],
  corner: ["N", "E"],
};
const ROT_ORDER = ["N", "E", "S", "W"];

export function openPorts(type, rotationSteps) {
  return TYPES[type].map((port) => {
    const idx = (ROT_ORDER.indexOf(port) + rotationSteps) % 4;
    return ROT_ORDER[idx];
  });
}

export function createGridTray(
  originX,
  originZ,
  width,
  depth,
  depthDrop = 0.1,
) {
  const group = new THREE.Group();
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    roughness: 0.9,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x3a4653,
    metalness: 0.6,
    roughness: 0.4,
  });

  const base = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), trayMat);
  base.rotation.x = -Math.PI / 2;
  base.position.set(originX, -depthDrop, originZ);
  group.add(base);

  const t = 0.06;
  const walls = [
    { w: width, d: t, x: originX, z: originZ - depth / 2 },
    { w: width, d: t, x: originX, z: originZ + depth / 2 },
    { w: t, d: depth, x: originX - width / 2, z: originZ },
    { w: t, d: depth, x: originX + width / 2, z: originZ },
  ];
  for (const w of walls) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, depthDrop, w.d),
      curbMat,
    );
    wall.position.set(w.x, -depthDrop / 2, w.z);
    group.add(wall);
  }
  return group;
}

// rotate a junction's mesh with a tween, then rerun the flood-fill
function rotateJunctionMesh(mesh, onDone) {
  const start = mesh.rotation.y;
  const target = start + Math.PI / 2;
  const duration = 180;
  const t0 = performance.now();

  function step(now) {
    const t = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    mesh.rotation.y = start + (target - start) * eased;
    if (t < 1) requestAnimationFrame(step);
    else onDone?.();
  }
  requestAnimationFrame(step);
}

export function buildPuzzleGrid({
  interactionSystem,
  models, // { straight: gltf.scene, corner: gltf.scene }
  layout, // rows x cols of { type, rotation }
  originX,
  originZ,
  tileSize = 0.5,
}) {
  const junctions = [];

  layout.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      const source = cell.type === "straight" ? models.straight : models.corner;
      const mesh = SkeletonUtils.clone(source);

      mesh.position.set(
        originX + colIdx * tileSize,
        0,
        originZ - rowIdx * tileSize,
      );
      mesh.rotation.y = (cell.rotation * Math.PI) / 2;

      const junctionData = {
        mesh,
        gridX: colIdx,
        gridY: rowIdx,
        type: cell.type,
        rotation: cell.rotation,
      };

      mesh.userData = {
        type: "junction",
        onInteract: (objectiveTracker, scene) => {
          rotateJunctionMesh(mesh, () => {
            junctionData.rotation = (junctionData.rotation + 1) % 4;
            checkPuzzleSolved(junctions); // wire up your flood-fill here
          });
        },
      };

      interactionSystem.register(mesh); // register() already calls scene.add
      junctions.push(junctionData);
    });
  });

  return junctions;
}

function checkPuzzleSolved(junctions) {
  // BFS/flood-fill from source cell to target cell using openPorts(),
  // same logic as PuzzleState.checkPath() from earlier — omitted here
  // since it doesn't depend on the InteractionSystem wiring.
}
