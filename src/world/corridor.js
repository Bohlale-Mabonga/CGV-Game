import * as THREE from 'three';

function createWallSegment(side, startZ, segmentLength, height, width, material) {
  if (segmentLength <= 0.05) return null;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(segmentLength, height),
    material
  );

  wall.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  wall.position.set(
    side === 'left' ? -width / 2 : width / 2,
    height / 2,
    startZ + segmentLength / 2
  );

  return wall;
}

function createWallWithOpenings(
  segment,
  side,
  length,
  width,
  height,
  material,
  openings = []
) {
  const sideOpenings = openings
    .filter((opening) => opening.side === side)
    .map((opening) => ({ z: opening.z, width: opening.width || 1.8 }))
    .sort((a, b) => a.z - b.z);

  let cursor = -length / 2;

  for (const opening of sideOpenings) {
    const openingStart = Math.max(-length / 2, opening.z - opening.width / 2);
    const openingEnd = Math.min(length / 2, opening.z + opening.width / 2);
    const wall = createWallSegment(
      side,
      cursor,
      openingStart - cursor,
      height,
      width,
      material
    );

    if (wall) segment.add(wall);
    cursor = Math.max(cursor, openingEnd);
  }

  const finalWall = createWallSegment(
    side,
    cursor,
    length / 2 - cursor,
    height,
    width,
    material
  );

  if (finalWall) segment.add(finalWall);
}

export function createCorridorSegment(
  length = 10,
  width = 4,
  height = 3,
  openings = []
) {
  const segment = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x555a63,
    roughness: 0.8,
    metalness: 0.25,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e3138,
    roughness: 0.9,
    metalness: 0.1,
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

  createWallWithOpenings(
    segment,
    'left',
    length,
    width,
    height,
    wallMaterial,
    openings
  );

  createWallWithOpenings(
    segment,
    'right',
    length,
    width,
    height,
    wallMaterial,
    openings
  );

  return segment;
}

export function createSideRoom(width = 4, depth = 4, height = 3) {
  const room = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b535f,
    roughness: 0.85,
    metalness: 0.2,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.9,
    metalness: 0.1,
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

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.035, 8, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8
    })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

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

    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.08;
    ring.scale.set(scale, scale, scale);
  };

  return group;
}
