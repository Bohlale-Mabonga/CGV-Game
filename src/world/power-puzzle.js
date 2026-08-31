import * as THREE from 'three';

let routeProgress = 0;
const correctRoute = [1, 3, 2];

const routeColors = {
    1: 0x37c8ff,
    3: 0xffd43b,
    2: 0x37ff8b
};

export function createPowerJunction(position, id) {
    const group = new THREE.Group();
    group.position.copy(position);

    const inactiveMaterial = new THREE.MeshStandardMaterial({
        color: 0x333a44,
        emissive: 0x000000
    });

    const activeMaterial = new THREE.MeshStandardMaterial({
        color: 0x37ff8b,
        emissive: 0x0b4a24,
        emissiveIntensity: 1
    });

    const wrongMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3344,
        emissive: 0x4a0000,
        emissiveIntensity: 1
    });

    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.7, 0.2),
        inactiveMaterial
    );
    group.add(panel);

    const clueLight = new THREE.PointLight(routeColors[id], 0.8, 2);
    clueLight.position.set(0, 0.65, 0.1);
    group.add(clueLight);

    const clueMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshBasicMaterial({ color: routeColors[id] })
    );
    clueMarker.position.set(0, 0.55, 0.12);
    group.add(clueMarker);

    group.userData.type = 'junction';
    group.userData.id = id;
    group.userData.isActive = false;
    group.userData.panel = panel;
    group.userData.inactiveMaterial = inactiveMaterial;
    group.userData.activeMaterial = activeMaterial;
    group.userData.wrongMaterial = wrongMaterial;

    group.userData.onInteract = () => {
        const expectedId = correctRoute[routeProgress];

        if (group.userData.id === expectedId) {
            group.userData.isActive = true;
            panel.material = activeMaterial;
            routeProgress++;

            console.log(`Correct junction ${group.userData.id}`);
        } else {
            console.log(`Wrong junction ${group.userData.id} - puzzle reset`);

            routeProgress = 0;

            panel.material = wrongMaterial;

            setTimeout(() => {
                panel.material = inactiveMaterial;
            }, 400);
        }
    };

    group.userData.reset = () => {
        group.userData.isActive = false;
        panel.material = inactiveMaterial;
    };

    return group;
}

export function createReactorConsole(position) {
    const incompleteMaterial = new THREE.MeshStandardMaterial({
        color: 0x884444,
        emissive: 0x220000,
        emissiveIntensity: 0.5
    });

    const completeMaterial = new THREE.MeshStandardMaterial({
        color: 0x37ff8b,
        emissive: 0x0b4a24,
        emissiveIntensity: 1
    });

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1, 0.35),
        incompleteMaterial
    );

    mesh.position.copy(position);

    mesh.userData.type = 'console';
    mesh.userData.isComplete = false;
    mesh.userData.incompleteMaterial = incompleteMaterial;
    mesh.userData.completeMaterial = completeMaterial;

    mesh.userData.setComplete = () => {
        if (mesh.userData.isComplete) return;

        mesh.userData.isComplete = true;
        mesh.material = completeMaterial;

        console.log('Power routing puzzle complete');
    };

    mesh.userData.reset = () => {
        mesh.userData.isComplete = false;
        mesh.material = incompleteMaterial;
    };

    return mesh;
}

export function updatePowerPuzzle(junctions, consoleMesh) {
    const puzzleComplete = routeProgress >= correctRoute.length;

    if (puzzleComplete) {
        consoleMesh.userData.setComplete();
    }

    return puzzleComplete;
}

export function resetPowerPuzzle(junctions, consoleMesh) {
    routeProgress = 0;

    for (const junction of junctions) {
        junction.userData.reset();
    }

    consoleMesh.userData.reset();
}