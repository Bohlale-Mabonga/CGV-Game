import * as THREE from 'three';

function addWallPanel(room, angle, radius, color) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.18), new THREE.MeshStandardMaterial({ color: 0x101923, metalness: 0.72, roughness: 0.36 }));
    panel.position.set(Math.sin(angle) * radius, 1.25, Math.cos(angle) * radius);
    panel.rotation.y = angle;
    room.add(panel);

    const display = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.45), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    display.position.set(Math.sin(angle) * (radius - 0.11), 1.35, Math.cos(angle) * (radius - 0.11));
    display.rotation.y = angle + Math.PI;
    room.add(display);
}

export function createControlRoom(position) {
    const room = new THREE.Group();
    room.position.copy(position);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111b27, roughness: 0.58, metalness: 0.52 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x202d3b, roughness: 0.62, metalness: 0.48, side: THREE.DoubleSide });

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.25, 32), floorMaterial);
    floor.position.y = -0.13;
    floor.receiveShadow = true;
    room.add(floor);

    const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 3.8, 32, 1, true), wallMaterial);
    outerWall.position.y = 1.9;
    room.add(outerWall);

    const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.2, 32), wallMaterial);
    ceiling.position.y = 3.8;
    room.add(ceiling);

    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.07, 8, 64), new THREE.MeshBasicMaterial({ color: 0x37c8ff }));
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = 0.03;
    room.add(floorRing);

    const centralPlatform = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.45, 24), new THREE.MeshStandardMaterial({ color: 0x344657, metalness: 0.85, roughness: 0.28 }));
    centralPlatform.position.y = 0.24;
    room.add(centralPlatform);

    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 10, 32), new THREE.MeshBasicMaterial({ color: 0xff3eb5 }));
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.y = 0.5;
    room.add(coreRing);

    for (let i = 0; i < 8; i += 1) addWallPanel(room, (i / 8) * Math.PI * 2, 6.9, i % 2 ? 0xff3eb5 : 0x37c8ff);

    for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.5, 0.24), wallMaterial);
        pillar.position.set(Math.sin(angle) * 7.15, 1.75, Math.cos(angle) * 7.15);
        room.add(pillar);
    }

    const roomLight = new THREE.PointLight(0x37c8ff, 2.4, 13);
    roomLight.position.set(0, 3, 0);
    room.add(roomLight);
    const magentaLight = new THREE.PointLight(0xff3eb5, 1.3, 8);
    magentaLight.position.set(0, 1.2, 2.8);
    room.add(magentaLight);

    room.userData.update = (delta) => {
        coreRing.rotation.z += delta * 0.35;
        roomLight.intensity = 2.1 + Math.sin(performance.now() * 0.003) * 0.25;
    };

    return room;
}
