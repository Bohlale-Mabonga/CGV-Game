import * as THREE from 'three';

// Attaches a spotlight as a CHILD of the camera, so it always points
// wherever the player looks. This is your "moving light" for Viewing marks.
export function createFlashlight(camera) {
  const light = new THREE.SpotLight(0xffffff, 80, 12, Math.PI / 6, 0.4, 1.5);
  light.position.set(0, 0, 0);

  const target = new THREE.Object3D();
  target.position.set(0, 0, -1);
  camera.add(target);
  light.target = target;

  camera.add(light);
  return light;
}
