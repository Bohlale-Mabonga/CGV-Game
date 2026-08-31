import * as THREE from 'three';

export function createReactorCore(position) {
    const group = new THREE.Group();
    group.position.copy(position);

    const coreMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            baseColor: { value: new THREE.Color(0xff5533) },
            glowColor: { value: new THREE.Color(0xffdd66) }
        },
        vertexShader: `
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      uniform vec3 glowColor;

      varying vec3 vNormal;

      void main() {
        float pulse = 0.5 + 0.5 * sin(time * 4.0);
        float rim = 1.0 - abs(vNormal.z);

        vec3 color = mix(baseColor, glowColor, pulse);
        color += glowColor * rim * 0.8;

        gl_FragColor = vec4(color, 1.0);
      }
    `
    });

    const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 32),
        coreMaterial
    );
    group.add(core);

    const pointLight = new THREE.PointLight(0xff6633, 3, 8);
    group.add(pointLight);

    group.userData.type = 'reactorCore';
    group.userData.isSealed = false;

    group.userData.update = (delta) => {
        coreMaterial.uniforms.time.value += delta;
        group.rotation.y += delta * 0.6;

        const pulse = 2.5 + Math.sin(Date.now() * 0.006) * 0.8;
        pointLight.intensity = pulse;
    };

    group.userData.seal = () => {
        if (group.userData.isSealed) return;

        group.userData.isSealed = true;
        coreMaterial.uniforms.baseColor.value.set(0x37c8ff);
        coreMaterial.uniforms.glowColor.value.set(0x99eeff);
        pointLight.color.set(0x37c8ff);

        console.log('Reactor core sealed - game complete');
    };

    return group;
}

export function checkCoreReached(camera, reactorCore, range = 2) {
    const distance = camera.position.distanceTo(reactorCore.position);

    return distance <= range;
}