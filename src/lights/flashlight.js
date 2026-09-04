import * as THREE from "three";
// flashlight

export function createFlashlight(camera) {
  const light = new THREE.SpotLight(0xffffff, 80, 12, Math.PI / 16, 0.4, 1.5);

  light.position.set(0, 0, 0);

  const target = new THREE.Object3D();
  target.position.set(0, 0, -1);

  camera.add(target);

  light.target = target;

  camera.add(light);

  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyF") {
      light.visible = !light.visible;
      console.log(`Flashlight ${light.visible ? "on" : "off"}`);
    }
  });

  return light;
}
