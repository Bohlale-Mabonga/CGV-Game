import * as THREE from 'three';

export function createControlRoom(position) {
    const room = new THREE.Group();
    room.position.copy(position);

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x252a32,
        roughness: 0.9,
        side: THREE.DoubleSide
    });

    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d4652,
        roughness: 0.85,
        side: THREE.DoubleSide
    });

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        floorMaterial
    );
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);

    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        wallMaterial
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3;
    room.add(ceiling);

    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 3),
        wallMaterial
    );
    backWall.position.set(0, 1.5, -4);
    room.add(backWall);

    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 3),
        wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-4, 1.5, 0);
    room.add(leftWall);

    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 3),
        wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(4, 1.5, 0);
    room.add(rightWall);

    const roomLight = new THREE.PointLight(0x37c8ff, 1.5, 7);
    roomLight.position.set(0, 2.6, 0);
    room.add(roomLight);

    return room;
}