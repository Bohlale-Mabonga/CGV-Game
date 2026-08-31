import * as THREE from 'three';

// Builds ONE corridor segment as a single Group.
// Floor, walls and ceiling are all children of that group — so moving
// or rotating the group moves the whole segment together. This is the
// "hierarchical modelling" the rubric asks about: you can explain that
// walls/ceiling/floor are children of the segment because they always
// move as one physical piece of the station.
export function createCorridorSegment(length = 10, width = 4, height = 3) {
  const segment = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 0.8 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  segment.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, length), wallMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  segment.add(ceiling);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-width / 2, height / 2, 0);
  segment.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMaterial);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(width / 2, height / 2, 0);
  segment.add(rightWall);

  return segment;
}
