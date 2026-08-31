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
