import * as THREE from 'three';

export function createSecurityBeam(position) {
    const group = new THREE.Group();
    group.position.copy(position);

    const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.8, 7),
        new THREE.MeshBasicMaterial({
            color: 0xff3344,
            transparent: true,
            opacity: 0.45
        })
    );

    beam.position.y = 1;
    group.add(beam);

    const light = new THREE.PointLight(0xff3344, 1.5, 4);
    light.position.y = 1.2;
    group.add(light);

    group.userData.angle = 0;
    group.userData.speed = 0.15;
    group.userData.radius = 0.55;

    group.userData.update = (delta) => {
        group.userData.angle += delta * group.userData.speed;

        const sweep = Math.sin(group.userData.angle);
        group.position.x = position.x + sweep * 3;
    };

    return group;
}

export function checkSecurityBeamHit(camera, securityBeams, checkpointPosition) {
    for (const beam of securityBeams) {
        const playerPosition = camera.position;

        const insideX = Math.abs(playerPosition.x - beam.position.x) < 0.45;
        const insideZ =
            playerPosition.z < beam.position.z + 3.5 &&
            playerPosition.z > beam.position.z - 3.5;

        if (insideX && insideZ) {
            camera.position.copy(checkpointPosition);
            console.log('Hit by security beam - returned to checkpoint');
            return true;
        }
    }

    return false;
}