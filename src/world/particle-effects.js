import * as THREE from 'three';

function seededRandom(index) {
    const value = Math.sin(index * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

export function createSparkField(position, color = 0xffb347, count = 80, spread = 2.5) {
    const group = new THREE.Group();
    group.position.copy(position);

    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (seededRandom(i + 1) - 0.5) * spread;
        positions[i * 3 + 1] = seededRandom(i + 20) * spread;
        positions[i * 3 + 2] = (seededRandom(i + 40) - 0.5) * spread;
        velocities.push({
            x: (seededRandom(i + 60) - 0.5) * 0.35,
            y: -(0.35 + seededRandom(i + 80) * 0.75),
            z: (seededRandom(i + 100) - 0.5) * 0.35
        });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color,
        size: 0.055,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);

    group.userData.update = (delta, intensity = 1) => {
        const attribute = geometry.getAttribute('position');
        for (let i = 0; i < count; i += 1) {
            const velocity = velocities[i];
            attribute.array[i * 3] += velocity.x * delta * intensity;
            attribute.array[i * 3 + 1] += velocity.y * delta * intensity;
            attribute.array[i * 3 + 2] += velocity.z * delta * intensity;
            if (attribute.array[i * 3 + 1] < 0) {
                attribute.array[i * 3] = (seededRandom(i + Math.floor(performance.now() / 1000)) - 0.5) * spread;
                attribute.array[i * 3 + 1] = spread * 0.8;
                attribute.array[i * 3 + 2] = (seededRandom(i + 130) - 0.5) * spread;
            }
        }
        attribute.needsUpdate = true;
        material.opacity = 0.55 + Math.sin(performance.now() * 0.02) * 0.25;
    };

    return group;
}

export function createHeatHaze(position) {
    const group = new THREE.Group();
    group.position.copy(position);

    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, heat: { value: 0.7 } },
        vertexShader: `
      uniform float time;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        displaced.x += sin(time * 2.0 + position.y * 3.0) * 0.08;
        displaced.z += cos(time * 1.6 + position.y * 2.0) * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
        fragmentShader: `
      uniform float time;
      uniform float heat;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.5, 0.05, distance(vUv, vec2(0.5)));
        float wave = 0.5 + 0.5 * sin(time * 3.0 + vUv.y * 8.0);
        gl_FragColor = vec4(1.0, 0.16 + wave * 0.2, 0.02, edge * heat * 0.2);
      }
    `
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 4, 12, 18), material);
    mesh.position.y = 2;
    group.add(mesh);
    group.userData.update = (delta, intensity = 1) => {
        material.uniforms.time.value += delta;
        material.uniforms.heat.value = intensity;
        mesh.scale.setScalar(0.9 + intensity * 0.2);
    };
    return group;
}
