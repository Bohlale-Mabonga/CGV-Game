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
  wall.receiveShadow = true;

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
    color: 0x303b48,
    roughness: 0.65,
    metalness: 0.55,
    side: THREE.DoubleSide
  });

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x161e27,
    roughness: 0.72,
    metalness: 0.38,
    side: THREE.DoubleSide
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  segment.add(floor);

  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x263b4b });
  for (let z = -length / 2 + 1; z < length / 2; z += 2) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(width - 0.18, 0.012, 0.025), seamMaterial);
    seam.position.set(0, 0.012, z);
    segment.add(seam);
  }

  for (const x of [-width * 0.32, width * 0.32]) {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, length - 0.2), new THREE.MeshBasicMaterial({ color: 0x1b7186 }));
    lane.position.set(x, 0.018, 0);
    segment.add(lane);
  }

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    wallMaterial
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  segment.add(ceiling);

  const ceilingLightMaterial = new THREE.MeshBasicMaterial({ color: 0x8eeaff });
  for (let z = -length / 2 + 1.5; z < length / 2; z += 3) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.035, 0.32), ceilingLightMaterial);
    panel.position.set(0, height - 0.025, z);
    segment.add(panel);
    const light = new THREE.PointLight(0x37c8ff, 0.32, 3.5);
    light.position.set(0, height - 0.15, z);
    segment.add(light);
  }

  const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x596a78, metalness: 0.8, roughness: 0.3 });
  for (const x of [-width / 2 + 0.24, width / 2 - 0.24]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 10), pipeMaterial);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, height - 0.26, 0);
    segment.add(pipe);
  }

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
  floor.receiveShadow = true;
  room.add(floor);

  const floorGrid = new THREE.GridHelper(Math.min(width, depth) - 0.2, 8, 0x1d5f73, 0x142a35);
  floorGrid.position.y = 0.018;
  floor.add(floorGrid);

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

  const consoleMaterial = new THREE.MeshStandardMaterial({ color: 0x101822, metalness: 0.7, roughness: 0.35 });
  const console = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.75, 0.42), consoleMaterial);
  console.position.set(0, 0.38, -depth / 2 + 0.38);
  room.add(console);
  const consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.42, 0.22), new THREE.MeshBasicMaterial({ color: 0x37c8ff }));
  consoleScreen.position.set(0, 0.65, -depth / 2 + 0.15);
  consoleScreen.rotation.x = -0.18;
  room.add(consoleScreen);

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
