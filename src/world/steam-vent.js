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

  const statusLight = new THREE.PointLight(0x37c8ff, 0.5, 1.5);
  statusLight.position.set(0, 0.12, 0);
  group.add(statusLight);

  group.userData.state = 'safe';
  group.userData.isActive = false;
  group.userData.timer = 0;
  group.userData.safeDuration = 1.8;
  group.userData.warningDuration = 0.85;
  group.userData.activeDuration = 1.35;
  group.userData.radius = 0.75;

  group.userData.update = (delta) => {
    group.userData.timer += delta;

    if (group.userData.state === 'safe' && group.userData.timer >= group.userData.safeDuration) {
      group.userData.state = 'warning';
      group.userData.timer = 0;
    } else if (
      group.userData.state === 'warning' &&
      group.userData.timer >= group.userData.warningDuration
    ) {
      group.userData.state = 'active';
      group.userData.timer = 0;
    } else if (
      group.userData.state === 'active' &&
      group.userData.timer >= group.userData.activeDuration
    ) {
      group.userData.state = 'safe';
      group.userData.timer = 0;
    }

    const isWarning = group.userData.state === 'warning';
    const isActive = group.userData.state === 'active';
    group.userData.isActive = isActive;

    steam.visible = isActive;
    warningLight.color.set(isActive || isWarning ? 0xff5533 : 0x334455);
    warningLight.intensity = isActive
      ? 1.4
      : isWarning
        ? 0.55 + Math.sin(performance.now() * 0.025) * 0.45
        : 0.15;
    statusLight.color.set(isActive || isWarning ? 0xff5533 : 0x37c8ff);
    statusLight.intensity = isActive ? 0.15 : isWarning ? 1.1 : 0.55;

    base.material.emissive?.set(isWarning ? 0x3d0905 : 0x000000);
    base.material.emissiveIntensity = isWarning ? 0.7 : 0;

    if (isActive) {
      steam.rotation.y += delta * 2;
      steam.material.opacity = 0.32 + Math.sin(performance.now() * 0.01) * 0.12;
    }
  };

  return group;
}

export function checkSteamVentHit(playerPosition, steamVents) {
  for (const vent of steamVents) {
    if (!vent.userData.isActive) continue;

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
      return true;
    }
  }

  return false;
}
