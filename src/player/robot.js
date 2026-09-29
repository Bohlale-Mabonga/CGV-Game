import * as THREE from "three";
import { loadFBX } from "../core/assets.js";

/** Third-person body that follows the first-person camera. */
export async function createRobot(scene, camera, controls) {
  const [model, walkFbx, idleFbx] = await Promise.all([
    loadFBX("assets/robot.fbx"),
    loadFBX("assets/Walking.fbx"),
    loadFBX("assets/Idle.fbx"),
  ]);

  model.position.set(0, 0, -2);
  model.rotation.y = Math.PI;
  model.scale.setScalar(0.1);
  scene.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(idleFbx.animations[0]);
  const walk = mixer.clipAction(walkFbx.animations[0]);
  idle.play();

  const eyeHeight = camera.position.y;
  const lastPos = camera.position.clone();
  let current = idle;

  function updateLocomotion() {
    const moving = camera.position.distanceTo(lastPos) > 0.001;
    lastPos.copy(camera.position);

    const next = moving ? walk : idle;
    if (next !== current) {
      next.reset().fadeIn(0.2).play();
      current.fadeOut(0.2);
      current = next;
    }
  }

  return {
    model,
    update(delta) {
      mixer.update(delta);
      model.position.set(camera.position.x, camera.position.y - eyeHeight, camera.position.z);
      model.rotation.y = controls.getYaw() + Math.PI;
      updateLocomotion();
    },
  };
}
