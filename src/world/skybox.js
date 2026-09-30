import * as THREE from "three";
import { loadTexture } from "../core/assets.js";

const SKYBOX_URL = "assets/iss_skybox_cross.png";

// Standard "vertical cross" cubemap sheet: a 4x3 grid of square faces. The
// front face sits in the middle column so the up and down faces land directly
// above and below it, and the two side faces flank it.
//
//          col 0     col 1     col 2     col 3
//   row 0: [   ]      [ +Y ]    [   ]     [   ]
//   row 1: [ -X ]     [ +Z ]    [ +X ]    [ -Z ]
//   row 2: [   ]      [ -Y ]    [   ]     [   ]
//
// `face` is the index CubeTexture expects: 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
const CROSS_FACES = [
  { face: 2, col: 1, row: 0 }, // up
  { face: 3, col: 1, row: 2 }, // down
  { face: 0, col: 2, row: 1 }, // right
  { face: 1, col: 0, row: 1 }, // left
  { face: 4, col: 1, row: 1 }, // front
  { face: 5, col: 3, row: 1 }, // back
];

/**
 * Slices a cross-layout cubemap sheet into six faces and uses it as the
 * scene background.
 *
 * three.js only uploads a CubeTexture when it is given six images
 * (uploadCubeTexture returns early otherwise), so the sheet has to be split
 * by hand rather than handed over whole.
 */
export async function createSkybox(scene, url = SKYBOX_URL) {
  const sheet = (await loadTexture(url)).image;

  const faceWidth = sheet.width / 4;
  const faceHeight = sheet.height / 3;
  if (faceWidth !== faceHeight) {
    throw new Error(
      `createSkybox: ${url} is ${sheet.width}x${sheet.height}, expected a 4:3 grid of square faces`,
    );
  }

  const faces = new Array(6);
  for (const { face, col, row } of CROSS_FACES) {
    const canvas = document.createElement("canvas");
    canvas.width = faceWidth;
    canvas.height = faceHeight;
    canvas
      .getContext("2d")
      .drawImage(
        sheet,
        col * faceWidth,
        row * faceHeight,
        faceWidth,
        faceHeight,
        0,
        0,
        faceWidth,
        faceHeight,
      );
    faces[face] = canvas;
  }

  const texture = new THREE.CubeTexture(faces);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  scene.background = texture;
  return texture;
}
