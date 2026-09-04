import * as THREE from 'three';

export function createCorridorSegment(length = 10, width = 4, height = 3) {
  const segment = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x555a63,
    roughness: 0.8,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e3138,
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  segment.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    wallMaterial
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  segment.add(ceiling);

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(length, height),
    wallMaterial
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-width / 2, height / 2, 0);
  segment.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(length, height),
    wallMaterial
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(width / 2, height / 2, 0);
  segment.add(rightWall);

  return segment;
}

export function createSideRoom(width = 4, depth = 4, height = 3) {
  const room = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b535f,
    roughness: 0.85,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.9,
    side: THREE.DoubleSide
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    wallMaterial
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  room.add(ceiling);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    wallMaterial
  );
  backWall.position.set(0, height / 2, -depth / 2);
  room.add(backWall);

  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, height),
    wallMaterial
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-width / 2, height / 2, 0);
  room.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(depth, height),
    wallMaterial
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(width / 2, height / 2, 0);
  room.add(rightWall);

  const roomLight = new THREE.PointLight(0x37c8ff, 1.2, 5);
  roomLight.position.set(0, 2.4, 0);
  room.add(roomLight);

  return room;
}

export function createHintBeacon(position, color = 0x37c8ff) {
  const group = new THREE.Group();
  group.position.copy(position);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshBasicMaterial({
      color
    })
  );
  group.add(marker);

  const light = new THREE.PointLight(color, 1.2, 3);
  group.add(light);

  group.userData.update = (delta) => {
    group.rotation.y += delta * 2;
    light.intensity = 0.8 + Math.sin(Date.now() * 0.006) * 0.4;
  };

  return group;
}