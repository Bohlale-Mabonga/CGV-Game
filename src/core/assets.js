import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();

export const loadGLTF = (url) =>
  new Promise((resolve, reject) =>
    gltfLoader.load(url, resolve, undefined, reject),
  );

export const loadFBX = (url) =>
  new Promise((resolve, reject) =>
    fbxLoader.load(url, resolve, undefined, reject),
  );

/** Resolves once the bitmap is decoded, so `texture.image` is safe to slice. */
export const loadTexture = (url) =>
  new Promise((resolve, reject) =>
    textureLoader.load(url, resolve, undefined, reject),
  );

const LEVEL_GLTFS = {
  straight: "assets/straight-corridor.glb",
  x: "assets/x-corridor.glb",
  office: "assets/office.glb",
  coreAccess: "assets/core_access.glb",
  door: "assets/sliding_door.glb",
  straightTile: "assets/s_tile.glb",
  cornerTile: "assets/c_tile.glb",
  battery: "assets/battery.glb",
  containment: "assets/containment.glb",
};

/** Loads every level model in parallel -> { straight, x, office, door, ... } */
export async function loadLevelAssets() {
  const entries = await Promise.all(
    Object.entries(LEVEL_GLTFS).map(async ([key, url]) => [
      key,
      await loadGLTF(url),
    ]),
  );
  return Object.fromEntries(entries);
}
