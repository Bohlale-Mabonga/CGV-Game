

import * as THREE from 'three';
import { NOISE_GLSL } from './noise.glsl.js';

export const StationFxShader = {
  name: 'StationFxShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uHeat: { value: 0 },
    uAberration: { value: 0.002 },
    uDamage: { value: 0 },
    uGlitch: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.025 },
    uScanline: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uLetterbox: { value: 0 },
    uFade: { value: 0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    ${NOISE_GLSL}
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uHeat;
    uniform float uAberration;
    uniform float uDamage;
    uniform float uGlitch;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uScanline;
    uniform vec3 uTint;
    uniform float uLetterbox;
    uniform float uFade;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Heat haze: rising noise offsets, strongest low on screen.
      if (uHeat > 0.001) {
        float n = snoise(vec3(uv * vec2(9.0, 5.0) + vec2(0.0, -uTime * 1.6), uTime * 0.6));
        uv += vec2(n * 0.0035, n * 0.005) * uHeat * (1.2 - uv.y);
      }

      // Glitch tearing: random horizontal bands jump sideways.
      if (uGlitch > 0.001) {
        float row = floor(uv.y * 28.0);
        float frame = floor(uTime * 18.0);
        float band = step(0.75, hash12(vec2(row, frame)));
        uv.x += (hash12(vec2(frame, row)) - 0.5) * 0.09 * uGlitch * band;
      }

      // Radial chromatic aberration.
      vec2 centered = uv - 0.5;
      float dist = length(centered);
      vec2 offset = centered * (uAberration + uDamage * 0.012 + uGlitch * 0.02) * dist * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv - offset).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + offset).b;

      col *= uTint;

      // Damage: red bleed from the screen edges.
      float edge = smoothstep(0.25, 0.85, dist);
      col = mix(col, col * vec3(1.4, 0.35, 0.3) + vec3(0.25, 0.0, 0.0) * edge, clamp(uDamage * edge * 1.6, 0.0, 1.0));

      // Vignette.
      col *= 1.0 - uVignette * smoothstep(0.3, 0.95, dist * 1.25);

      // Scanlines (reboot / CRT moments).
      col *= 1.0 - uScanline * (0.5 + 0.5 * sin(uv.y * uResolution.y * 1.4));

      // Film grain.
      col += (hash12(vUv * uResolution + fract(uTime * 7.31) * 100.0) - 0.5) * uGrain;

      // Letterbox bars and fade.
      float bars = step(uLetterbox, vUv.y) * step(vUv.y, 1.0 - uLetterbox);
      col *= bars * (1.0 - uFade);

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `
};
