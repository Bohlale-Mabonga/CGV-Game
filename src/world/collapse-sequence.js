import * as THREE from 'three';

export function createCollapseChunk(position, delay) {
    const material = new THREE.MeshStandardMaterial({
        color: 0x5d6470,
        roughness: 0.9
    });

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.35, 1.2),
        material
    );

    mesh.position.copy(position);

    mesh.userData.delay = delay;
    mesh.userData.timer = 0;
    mesh.userData.hasStarted = false;
    mesh.userData.hasCollapsed = false;
    mesh.userData.fallSpeed = 3;
    mesh.userData.hitRadius = 1;

    mesh.userData.update = (delta, sequenceStarted) => {
        if (!sequenceStarted || mesh.userData.hasCollapsed) return;

        mesh.userData.timer += delta;

        if (mesh.userData.timer < mesh.userData.delay) return;

        mesh.userData.hasStarted = true;

        mesh.position.y -= mesh.userData.fallSpeed * delta;

        if (mesh.position.y <= 0.35) {
            mesh.position.y = 0.35;
            mesh.userData.hasCollapsed = true;
            mesh.material.color.set(0x2d3036);

            console.log('Corridor chunk collapsed');
        }
    };

    mesh.userData.reset = () => {
        mesh.position.copy(position);
        mesh.userData.timer = 0;
        mesh.userData.hasStarted = false;
        mesh.userData.hasCollapsed = false;
        mesh.material.color.set(0x5d6470);
    };

    return mesh;
}

export function createCollapseSequence() {
    return [
        createCollapseChunk(new THREE.Vector3(-1.1, 2.8, -32), 0.6),
        createCollapseChunk(new THREE.Vector3(1.1, 2.8, -35), 1.4),
        createCollapseChunk(new THREE.Vector3(0, 2.8, -38), 2.2)
    ];
}

export function updateCollapseSequence(chunks, delta, sequenceStarted) {
    for (const chunk of chunks) {
        chunk.userData.update(delta, sequenceStarted);
    }
}

export function checkCollapseHit(camera, chunks, checkpointPosition) {
    for (const chunk of chunks) {
        if (!chunk.userData.hasCollapsed) continue;

        const flatPlayer = new THREE.Vector3(
            camera.position.x,
            0,
            camera.position.z
        );

        const flatChunk = new THREE.Vector3(
            chunk.position.x,
            0,
            chunk.position.z
        );

        const distance = flatPlayer.distanceTo(flatChunk);

        if (distance <= chunk.userData.hitRadius) {
            camera.position.copy(checkpointPosition);
            console.log('Blocked by collapsed corridor - returned to Level 3 start');
            return true;
        }
    }

    return false;
}

export function resetCollapseSequence(chunks) {
    for (const chunk of chunks) {
        chunk.userData.reset();
    }
}