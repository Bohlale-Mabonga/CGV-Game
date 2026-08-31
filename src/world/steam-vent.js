import * as THREE from 'three';

export function createSteamVent(position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.12, 0.8),
    new THREE.MeshStandardMaterial({
      color: 0x30343a,
      roughness: 0.8
    })
  );
  base.position.y = 0.06;
  group.add(base);

  const steam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 2.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbfdfff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    })
  );
  steam.position.y = 1.15;
  group.add(steam);

  const warningLight = new THREE.PointLight(0xff5533, 1.2, 2);
  warningLight.position.set(0, 0.35, 0);
  group.add(warningLight);

  group.userData.isActive = true;
  group.userData.timer = 0;
  group.userData.activeDuration = 1.5;
  group.userData.inactiveDuration = 1.8;
  group.userData.radius = 0.75;

  group.userData.update = (delta) => {
    group.userData.timer += delta;

    if (
      group.userData.isActive &&
      group.userData.timer >= group.userData.activeDuration
    ) {
      group.userData.isActive = false;
      group.userData.timer = 0;
    }

    if (
      !group.userData.isActive &&
      group.userData.timer >= group.userData.inactiveDuration
    ) {
      group.userData.isActive = true;
      group.userData.timer = 0;
    }

    steam.visible = group.userData.isActive;
    warningLight.color.set(group.userData.isActive ? 0xff5533 : 0x334455);
    warningLight.intensity = group.userData.isActive ? 1.2 : 0.25;

    if (group.userData.isActive) {
      steam.rotation.y += delta * 2;
      steam.material.opacity = 0.25 + Math.sin(Date.now() * 0.01) * 0.1;
    }
  };

  return group;
}

export function checkSteamVentHit(camera, steamVents, checkpointPosition) {
  for (const vent of steamVents) {
    if (!vent.userData.isActive) continue;

    const playerPosition = camera.position;

    const flatPlayerPosition = new THREE.Vector3(
      playerPosition.x,
      0,
      playerPosition.z
    );

    const flatVentPosition = new THREE.Vector3(
      vent.position.x,
      0,
      vent.position.z
    );

    const distance = flatPlayerPosition.distanceTo(flatVentPosition);

    if (distance <= vent.userData.radius) {
      camera.position.copy(checkpointPosition);
      console.log('Hit by steam vent - returned to checkpoint');
      return true;
    }
  }

  return false;
}