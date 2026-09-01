import * as THREE from 'three';

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

export function createLevel1Props() {
    const props = [];
    const animatedProps = [];

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
    props.push(createPipe(new THREE.Vector3(1.95, 2.0, -7), 4));
    props.push(createPipe(new THREE.Vector3(-1.95, 1.9, -12), 4));

    props.push(createCrate(new THREE.Vector3(-1.2, 0.4, -6)));
    props.push(createCrate(new THREE.Vector3(1.2, 0.4, -11)));

    props.push(createWarningPanel(new THREE.Vector3(-1.98, 1.4, -4)));
    props.push(createWarningPanel(new THREE.Vector3(1.98, 1.4, -13)));

    return {
        props,
        animatedProps
    };
}