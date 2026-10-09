

import * as THREE from 'three';
import { NOISE_GLSL } from './noise.glsl.js';

export function createReactorCoreMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInstability: { value: 0.4 },
      uSealed: { value: 0 },
      uColorCore: { value: new THREE.Color(0xff3a10) },
      uColorHot: { value: new THREE.Color(0xffb347) },
      uColorCool: { value: new THREE.Color(0x3fd0ff) }
    },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uInstability;
      uniform float uSealed;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vObjPos;
      varying float vDisp;

      void main() {
        float speed = mix(1.0, 0.25, uSealed);
        float n1 = snoise(normal * 1.6 + vec3(0.0, uTime * 0.6 * speed, 0.0));
        float n2 = snoise(normal * 4.2 - vec3(uTime * 1.1 * speed));
        float amplitude = mix(0.07 + 0.26 * uInstability, 0.03, uSealed);
        float d = (n1 * 0.65 + n2 * 0.35) * amplitude;
        vDisp = d;
        vec3 displaced = position + normal * d;
        vObjPos = displaced;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vPosW = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uInstability;
      uniform float uSealed;
      uniform vec3 uColorCore;
      uniform vec3 uColorHot;
      uniform vec3 uColorCool;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vObjPos;
      varying float vDisp;

      void main() {
        vec3 V = normalize(cameraPosition - vPosW);
        float fresnel = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 2.5);

        // Domain warping: offset the lookup by another noise field.
        vec3 q = vObjPos * 1.8 + vec3(0.0, uTime * 0.5, uTime * 0.2);
        vec3 warp = vec3(fbm(q), fbm(q + 5.2), fbm(q + 9.7));
        float plasma = fbm(q + warp * 1.6);

        float veins = 1.0 - abs(snoise(vObjPos * 3.2 + warp + uTime * 0.4));
        veins = pow(veins, 7.0);

        float pulse = 0.85 + 0.15 * sin(uTime * (2.5 + uInstability * 9.0));

        vec3 hot = mix(uColorCore, uColorHot, plasma);
        hot += vec3(1.0, 0.85, 0.55) * veins * (0.9 + uInstability * 2.0);
        hot += uColorHot * fresnel * 2.2;
        hot *= (0.9 + vDisp * 3.5) * pulse;

        vec3 cool = mix(vec3(0.03, 0.12, 0.3), uColorCool, plasma);
        cool += vec3(0.7, 0.95, 1.0) * veins * 0.6;
        cool += uColorCool * fresnel * 2.0;

        // Scaled so only the hottest veins and the rim exceed the bloom threshold.
        gl_FragColor = vec4(mix(hot, cool, uSealed) * 0.55, 1.0);
      }
    `
  });
}

// Additive atmospheric halo rendered on the back faces of a larger sphere.
export function createCoronaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInstability: { value: 0.4 },
      uSealed: { value: 0 },
      uColor: { value: new THREE.Color(0xff6a20) },
      uColorCool: { value: new THREE.Color(0x3fc8ff) }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosW = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uInstability;
      uniform float uSealed;
      uniform vec3 uColor;
      uniform vec3 uColorCool;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec3 V = normalize(cameraPosition - vPosW);
        float facing = dot(normalize(vNormalW), V);
        // Back faces seen from outside: facing runs from about -0.8 just outside
        // the core's silhouette to 0 at the halo's rim, so this fades outward.
        float glow = pow(clamp(-facing / 0.8, 0.0, 1.0), 2.5);
        float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + uInstability * 20.0);
        vec3 col = mix(uColor, uColorCool, uSealed) * glow * (0.6 + uInstability * 0.6) * flicker;
        gl_FragColor = vec4(col, glow);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
}
