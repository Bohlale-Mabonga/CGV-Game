import * as THREE from 'three';
import { createSign } from './signage.js';

export function createFlickerLight(position, color = 0x9fdcff) {
    const group = new THREE.Group();
    group.position.copy(position);

    const casing = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.08, 0.18),
        new THREE.MeshStandardMaterial({
            color: 0x20242b,
            roughness: 0.8
        })
    );
    group.add(casing);

    const bulb = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.03, 0.08),
        new THREE.MeshBasicMaterial({
            color
        })
    );
    bulb.position.y = -0.06;
    group.add(bulb);

    const light = new THREE.PointLight(color, 1.2, 4);
    light.position.y = -0.2;
    group.add(light);

    group.userData.update = () => {
        const flicker = Math.random() > 0.04 ? 1 : 0.25;
        light.intensity = 0.8 + flicker * 0.8;
        bulb.visible = flicker > 0.3;
    };

    return group;
}

export function createPipe(position, length = 4) {
    const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, length, 16),
        new THREE.MeshStandardMaterial({
            color: 0x777f8c,
            roughness: 0.7,
            metalness: 0.4
        })
    );

    pipe.position.copy(position);
    pipe.rotation.z = Math.PI / 2;

    return pipe;
}

export function createCrate(position) {
    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshStandardMaterial({
            color: 0x4a3b2c,
            roughness: 0.9
        })
    );

    crate.position.copy(position);

    return crate;
}

export function createWarningPanel(position) {
    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.35, 0.04),
        new THREE.MeshStandardMaterial({
            color: 0xffaa33,
            emissive: 0x4a2500,
            emissiveIntensity: 0.8
        })
    );

    panel.position.copy(position);

    return panel;
}

export function createCheckpointBeacon(position, color = 0x37c8ff) {
    const group = new THREE.Group();
    group.position.copy(position);

    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.82, 0.08, 24),
        new THREE.MeshStandardMaterial({
            color: 0x17242d,
            emissive: 0x062b36,
            emissiveIntensity: 0.7,
            metalness: 0.35,
            roughness: 0.55
        })
    );
    pad.position.y = 0.04;
    group.add(pad);

    const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78
    });

    const lowerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.53, 0.025, 8, 32),
        ringMaterial
    );
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = 0.11;
    group.add(lowerRing);

    const upperRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.018, 8, 32),
        ringMaterial.clone()
    );
    upperRing.rotation.x = Math.PI / 2;
    upperRing.position.y = 1.05;
    group.add(upperRing);

    const light = new THREE.PointLight(color, 1.3, 4);
    light.position.y = 0.65;
    group.add(light);

    group.userData.update = (delta) => {
        upperRing.rotation.z += delta * 1.6;
        const pulse = 0.85 + Math.sin(performance.now() * 0.005) * 0.25;
        upperRing.position.y = 0.95 + Math.sin(performance.now() * 0.004) * 0.12;
        lowerRing.material.opacity = pulse;
        light.intensity = 1 + pulse * 0.6;
    };

    return group;
}

function createDataTerminal(position, title, logMessage, color) {
    const group = new THREE.Group();
    group.position.copy(position);

    const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.15, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x1d2730, roughness: 0.65, metalness: 0.35 })
    );
    housing.position.y = 0.58;
    group.add(housing);

    const screenMaterial = new THREE.MeshBasicMaterial({ color });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), screenMaterial);
    screen.position.set(0, 0.74, 0.215);
    group.add(screen);

    const light = new THREE.PointLight(color, 0.8, 2.6);
    light.position.set(0, 0.75, 0.35);
    group.add(light);

    const label = createSign(title, new THREE.Vector3(0, 1.28, 0.22), 0, {
        widthWorld: 0.8,
        heightWorld: 0.18,
        width: 512,
        height: 128,
        fontSize: 35,
        border: '#71808f',
        background: '#101820'
    });
    group.add(label);

    group.userData.interactable = true;
    group.userData.type = 'terminal';
    group.userData.prompt = `Press E to access ${title}`;
    group.userData.read = false;
    group.userData.onInteract = () => {
        group.userData.read = true;
        screenMaterial.color.set(0x37ff8b);
        light.color.set(0x37ff8b);
        return { message: logMessage };
    };
    group.userData.update = (objectiveTracker, delta) => {
        const pulse = 0.65 + Math.sin(performance.now() * 0.006) * 0.2;
        light.intensity = group.userData.read ? 1.1 : pulse;
    };

    return group;
}

export function createLevel1Props() {
    const props = [];
    const animatedProps = [];
    const interactables = [];

    const lights = [
        createFlickerLight(new THREE.Vector3(0, 2.85, 1)),
        createFlickerLight(new THREE.Vector3(0, 2.85, -4)),
        createFlickerLight(new THREE.Vector3(0, 2.85, -9)),
        createFlickerLight(new THREE.Vector3(0, 2.85, -14))
    ];

    for (const light of lights) {
        props.push(light);
        animatedProps.push(light);
    }

    props.push(createPipe(new THREE.Vector3(-1.95, 2.2, -2), 4));
    props.push(createPipe(new THREE.Vector3(-5.65, 2.15, -5), 3.2));
    props.push(createPipe(new THREE.Vector3(5.65, 2.1, -10), 3.2));
    props.push(createPipe(new THREE.Vector3(-1.95, 1.9, -12), 4));

    // Maintenance bay: work equipment and an engineering log that hints at the steam timing.
    props.push(createCrate(new THREE.Vector3(-4.7, 0.4, -4.2)));
    props.push(createCrate(new THREE.Vector3(-5.45, 0.4, -4.25)));
    props.push(createWarningPanel(new THREE.Vector3(-5.88, 1.35, -5.4)));

    // Storage bay: a distinct, denser space around the second keycard.
    props.push(createCrate(new THREE.Vector3(4.75, 0.4, -9.1)));
    props.push(createCrate(new THREE.Vector3(5.55, 0.4, -9.1)));
    props.push(createCrate(new THREE.Vector3(5.15, 1.15, -9.1)));
    props.push(createWarningPanel(new THREE.Vector3(5.88, 1.3, -10.7)));

    props.push(createWarningPanel(new THREE.Vector3(-1.98, 1.4, -4)));
    props.push(createWarningPanel(new THREE.Vector3(1.98, 1.4, -13)));

    const maintenanceTerminal = createDataTerminal(
        new THREE.Vector3(-5.55, 0, -5.9),
        'VENT LOG',
        'Vent log: steam cycles on briefly, then leaves a safe window. Watch the warning light.',
        0x37c8ff
    );
    const storageTerminal = createDataTerminal(
        new THREE.Vector3(5.55, 0, -10.9),
        'CARGO LOG',
        'Cargo log: three access cards will unlock the reactor access door.',
        0xffd43b
    );

    props.push(maintenanceTerminal, storageTerminal);
    interactables.push(maintenanceTerminal, storageTerminal);

    return {
        props,
        animatedProps,
        interactables
    };
}
