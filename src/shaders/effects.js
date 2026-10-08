// Gameplay effect shaders. Each factory returns a THREE.ShaderMaterial whose
// uniforms are driven every frame by the object that owns it.

import * as THREE from 'three';
import { NOISE_GLSL } from './noise.glsl.js';

const WORLD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// ---------------------------------------------------------------------------
// HOLOGRAM — keycards, waypoint arrows and ARIA's projector.
// Vertex: rare horizontal "glitch" slices shear the mesh sideways.
// Fragment: Fresnel rim + scrolling world-space scanlines + flicker.
// ---------------------------------------------------------------------------
export function createHologramMaterial(color = 0x37c8ff, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity }
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vPosW;
      varying vec3 vNormalW;
      float rand(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec3 p = position;
        float slice = floor(p.y * 12.0 + uTime * 3.0);
        float glitchOn = step(0.985, rand(floor(uTime * 8.0)));
        p.x += (rand(slice + floor(uTime * 20.0)) - 0.5) * 0.12 * glitchOn;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vPosW = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vPosW;
      varying vec3 vNormalW;
      void main() {
        vec3 V = normalize(cameraPosition - vPosW);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), V)), 2.0);
        float scan = 0.55 + 0.45 * sin(vPosW.y * 90.0 - uTime * 6.0);
        float band = smoothstep(0.0, 0.05, fract(vPosW.y * 1.5 - uTime * 0.6)) * 0.4 + 0.6;
        float flicker = 0.9 + 0.1 * sin(uTime * 37.0);
        float a = (0.25 + fresnel * 0.9) * scan * band * flicker * uOpacity;
        gl_FragColor = vec4(uColor * (1.2 + fresnel * 1.8) * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// ---------------------------------------------------------------------------
// UV INK — a door code painted in "UV-reactive" paint that is invisible until
// the flashlight cone falls on it. The fragment shader reproduces the spot
// light's cone test itself (position, direction, inner/outer cosine) so the
// reveal matches the real light exactly.
// ---------------------------------------------------------------------------
export function createUvInkMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uLightPos: { value: new THREE.Vector3() },
      uLightDir: { value: new THREE.Vector3(0, 0, -1) },
      uCosOuter: { value: Math.cos(0.5) },
      uCosInner: { value: Math.cos(0.3) },
      uLightOn: { value: 0 },
      uColor: { value: new THREE.Color(0xb46bff) }
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec3 uLightPos;
      uniform vec3 uLightDir;
      uniform float uCosOuter;
      uniform float uCosInner;
      uniform float uLightOn;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vPosW;
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        vec3 toFrag = vPosW - uLightPos;
        float dist = length(toFrag);
        float cosAngle = dot(toFrag / dist, normalize(uLightDir));
        float cone = smoothstep(uCosOuter, uCosInner, cosAngle);
        float atten = 1.0 / (1.0 + dist * dist * 0.03);
        float reveal = clamp(cone * atten * uLightOn * 3.0, 0.0, 1.0);
        float shimmer = 0.85 + 0.15 * snoise(vec3(vUv * 40.0, uTime * 0.8));
        float a = tex.a * reveal * shimmer;
        gl_FragColor = vec4(uColor * 2.4 * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    blending: THREE.AdditiveBlending
  });
}

// ---------------------------------------------------------------------------
// STEAM — GPU particle system. Particle motion is computed entirely in the
// vertex shader from a per-particle random attribute (aSeed) and uTime, so the
// CPU uploads nothing per frame. uBurst (0..1) is the vent's state.
// ---------------------------------------------------------------------------
export function createSteamMaterial(map, { color = 0xe8f4ff, length = 3, spread = 0.6, size = 1.4 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uLength: { value: length },
      uSpread: { value: spread },
      uSize: { value: size },
      uDir: { value: new THREE.Vector3(0, 1, 0) },
      uColor: { value: new THREE.Color(color) },
      uMap: { value: map },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; // x: angle, y: radius, z: speed, w: phase
      uniform float uTime;
      uniform float uBurst;
      uniform float uLength;
      uniform float uSpread;
      uniform float uSize;
      uniform vec3 uDir;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        float t = fract(uTime * aSeed.z + aSeed.w);
        vec3 dir = normalize(uDir);
        vec3 up = abs(dir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 side = normalize(cross(dir, up));
        vec3 up2 = cross(side, dir);
        float reach = mix(0.25, 1.0, uBurst);
        float r = aSeed.y * uSpread * (0.15 + t * 1.3);
        vec3 p = dir * t * uLength * reach + (side * cos(aSeed.x) + up2 * sin(aSeed.x)) * r;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.3 + t * 1.3) * uPixelRatio * (140.0 / max(0.5, -mv.z));
        vAlpha = (1.0 - t) * smoothstep(0.0, 0.15, t) * mix(0.03, 0.5, uBurst);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false
  });
}

export function createSteamGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = Math.random() * Math.PI * 2;
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = 0.6 + Math.random() * 0.8;
    seeds[i * 4 + 3] = Math.random();
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  // Positions are computed on the GPU, so give the culler a generous bound.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
  return geometry;
}

// ---------------------------------------------------------------------------
// SECURITY SCANNER — a fake volumetric wedge of light. Brightest along its
// two angular edges, with range rings sweeping outward and noise "dust".
// uAlert (0..1) blends from cyan to red as the turret detects the player.
// ---------------------------------------------------------------------------
export function createScannerMaterial(radius, halfAngle) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAlert: { value: 0 },
      uRadius: { value: radius },
      uHalfAngle: { value: halfAngle },
      uColor: { value: new THREE.Color(0x37c8ff) },
      uAlertColor: { value: new THREE.Color(0xff2a3a) }
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uAlert;
      uniform float uRadius;
      uniform float uHalfAngle;
      uniform vec3 uColor;
      uniform vec3 uAlertColor;
      varying vec3 vLocal;
      void main() {
        float r = clamp(length(vLocal.xz) / uRadius, 0.0, 1.0);
        float ang = atan(vLocal.z, vLocal.x) / uHalfAngle; // -1..1 across the wedge
        float edge = smoothstep(0.7, 1.0, abs(ang));
        float rings = smoothstep(0.92, 1.0, fract(r * 7.0 - uTime * 1.8));
        float dust = snoise(vLocal * 0.7 + vec3(0.0, uTime * 0.4, uTime * 0.2)) * 0.5 + 0.5;
        float floorGlow = smoothstep(0.08, 0.0, vLocal.y) * 0.5;
        float a = (0.05 + edge * 0.35 + rings * 0.12 + floorGlow) * (1.15 - r) * (0.6 + 0.4 * dust);
        vec3 col = mix(uColor, uAlertColor, uAlert);
        gl_FragColor = vec4(col * a * 2.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// Closed pie-slice prism: the turret's wedge-shaped scan volume.
export function createWedgeGeometry(radius, height, halfAngle, segments = 24) {
  const pos = [];
  const push = (...v) => pos.push(...v);
  for (let i = 0; i < segments; i++) {
    const a0 = -halfAngle + (2 * halfAngle * i) / segments;
    const a1 = -halfAngle + (2 * halfAngle * (i + 1)) / segments;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    push(0, 0, 0, x1, 0, z1, x0, 0, z0); // bottom
    push(0, height, 0, x0, height, z0, x1, height, z1); // top
    push(x0, 0, z0, x1, 0, z1, x1, height, z1); // outer
    push(x0, 0, z0, x1, height, z1, x0, height, z0);
  }
  for (const a of [-halfAngle, halfAngle]) {
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    push(0, 0, 0, x, 0, z, x, height, z);
    push(0, 0, 0, x, height, z, 0, height, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------
// ENERGY FLOW — power cables in the control room. uv.x runs along the cable.
// uProgress (game state) is how far power has been routed; pulses only travel
// through the energised part and a bright "front" marks the leading edge.
// ---------------------------------------------------------------------------
export function createEnergyFlowMaterial(color = 0x37ff8b) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uError: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;
      uniform float uError;
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        float energised = step(vUv.x, uProgress);
        float pulse = smoothstep(0.6, 1.0, fract(vUv.x * 10.0 - uTime * 1.6));
        float front = smoothstep(0.04, 0.0, abs(vUv.x - uProgress)) * step(0.001, uProgress);
        float shade = 0.5 + 0.5 * normalize(vNormalW).y;
        vec3 base = vec3(0.025, 0.03, 0.04) * (0.6 + shade);
        vec3 col = base + uColor * energised * (0.25 + pulse * 1.6) + uColor * front * 3.0;
        col = mix(col, vec3(1.5, 0.15, 0.1) * (0.5 + 0.5 * sin(uTime * 40.0)), uError);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

// ---------------------------------------------------------------------------
// FORCE FIELD — hexagonal energy barrier. A hit at uImpactPos sends a ripple
// ring outward; uOpacity animates the field dissolving when it powers down.
// ---------------------------------------------------------------------------
export function createForceFieldMaterial(color = 0x37c8ff) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uImpactPos: { value: new THREE.Vector3(0, -999, 0) },
      uImpactTime: { value: -10 }
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec3 uImpactPos;
      uniform float uImpactTime;
      varying vec2 vUv;
      varying vec3 vPosW;
      varying vec3 vNormalW;

      // Distance to the nearest hexagon edge (0 at edges, ~0.5 in the centre).
      float hexEdge(vec2 p) {
        p.x *= 1.1547;
        p.y += mod(floor(p.x), 2.0) * 0.5;
        p = abs(fract(p) - 0.5);
        return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0);
      }

      void main() {
        vec2 grid = vPosW.xy * 3.0 + vPosW.zz * 3.0;
        float edge = 1.0 - smoothstep(0.0, 0.08, hexEdge(grid));
        float n = snoise(vec3(vPosW * 1.5 + uTime * 0.4)) * 0.5 + 0.5;
        float since = uTime - uImpactTime;
        float d = distance(vPosW, uImpactPos);
        float ripple = smoothstep(0.35, 0.0, abs(d - since * 4.0)) * exp(-since * 1.8);
        float dissolve = step(1.0 - uOpacity, n);
        float sweep = smoothstep(0.96, 1.0, fract(vUv.y * 1.0 - uTime * 0.35));
        float a = (0.12 + edge * 0.45 * (0.6 + 0.4 * n) + ripple * 1.2 + sweep * 0.25) * uOpacity * dissolve;
        gl_FragColor = vec4(uColor * a * 2.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// ---------------------------------------------------------------------------
// LAVA — the molten pit beneath the broken meltdown floor. The vertex stage
// ripples the surface; the fragment stage builds flowing crust and glowing
// cracks from domain-warped noise. uHeat rises with the meltdown.
// ---------------------------------------------------------------------------
export function createLavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0.5 }
    },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPosW;
      void main() {
        vUv = uv;
        vec3 p = position;
        vec4 w0 = modelMatrix * vec4(p, 1.0);
        p.z += snoise(vec3(w0.xz * 0.3, uTime * 0.3)) * 0.25;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vPosW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uHeat;
      varying vec2 vUv;
      varying vec3 vPosW;
      void main() {
        vec2 p = vPosW.xz * 0.35;
        vec3 q = vec3(p, uTime * 0.12);
        float warp = fbm(q + vec3(0.0, uTime * 0.15, 0.0));
        float n = fbm(vec3(p * 1.6 + warp * 1.8, uTime * 0.2));
        float cracks = pow(1.0 - abs(snoise(vec3(p * 3.0 + warp, uTime * 0.25))), 8.0);
        vec3 crust = vec3(0.12, 0.03, 0.01);
        vec3 molten = mix(vec3(1.0, 0.25, 0.02), vec3(1.6, 0.9, 0.3), n);
        float heat = smoothstep(0.35, 0.75, n) + cracks;
        vec3 col = mix(crust, molten * (1.4 + uHeat * 1.5), clamp(heat, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

// ---------------------------------------------------------------------------
// NEBULA SKY — the control room's dynamic skybox seen through its glass dome.
// A sphere that follows the camera; the fragment shader paints fBm nebula,
// twinkling hashed stars and a lit planet. uSpin rotates the view slowly, as
// if the station itself were turning.
// ---------------------------------------------------------------------------
export function createNebulaSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uAlarm: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.6, 0.3, -0.7).normalize() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // pin to the far plane
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uSpin;
      uniform float uAlarm;
      uniform vec3 uSunDir;
      varying vec3 vDir;

      vec3 rotY(vec3 v, float a) {
        float c = cos(a), s = sin(a);
        return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
      }

      void main() {
        vec3 dir = rotY(normalize(vDir), uSpin);
        float n = fbm(dir * 2.2 + vec3(0.0, 0.0, uTime * 0.01));
        float n2 = fbm(dir * 5.0 + n * 2.0);
        vec3 col = vec3(0.004, 0.006, 0.015);
        col += vec3(0.25, 0.05, 0.35) * pow(n, 3.0) * 1.3;
        col += vec3(0.02, 0.22, 0.32) * pow(n2, 4.0) * 1.6;

        // Stars: hash a quantised direction, twinkle with time.
        vec3 cell = floor(dir * 220.0);
        float h = hash12(cell.xy + cell.z * 17.0);
        float star = step(0.9965, h) * (0.6 + 0.4 * sin(uTime * 3.0 + h * 100.0));
        col += vec3(0.9, 0.95, 1.0) * star * 2.5;

        // Planet with day/night terminator and an atmospheric rim.
        vec3 planetDir = normalize(vec3(-0.5, -0.35, -0.8));
        float pr = 0.32;
        float pd = acos(clamp(dot(dir, planetDir), -1.0, 1.0));
        if (pd < pr) {
          float k = pd / pr;
          vec3 local = normalize(dir - planetDir * 0.85);
          float light = clamp(dot(local, normalize(uSunDir)) * 0.9 + 0.2, 0.0, 1.0);
          float bands = fbm(vec3(dir * 9.0 + vec3(uTime * 0.004, 0.0, 0.0)));
          vec3 surface = mix(vec3(0.05, 0.18, 0.35), vec3(0.6, 0.45, 0.3), bands);
          col = surface * light * 1.3 + vec3(0.2, 0.5, 1.0) * pow(k, 6.0) * 0.8;
        } else {
          col += vec3(0.25, 0.55, 1.0) * exp(-(pd - pr) * 30.0) * 0.8;
        }
        col = mix(col, col * vec3(1.6, 0.4, 0.35), uAlarm);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false
  });
}

// ---------------------------------------------------------------------------
// FIRE WALL — the collapse front chasing the player through the meltdown.
// The vertex stage billows the sheet toward the player with fBm; the fragment
// stage maps rising noise through a black-body style colour ramp.
// ---------------------------------------------------------------------------
export function createFireWallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 }
    },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      varying vec2 vUv;
      varying float vBillow;
      void main() {
        vUv = uv;
        vec3 p = position;
        float b = fbm(vec3(p.x * 0.5, p.y * 0.4 - uTime * 1.2, uTime * 0.3));
        p.z += b * 2.2 * (0.3 + uv.y);
        vBillow = b;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying float vBillow;
      void main() {
        float n = fbm(vec3(vUv.x * 6.0, vUv.y * 3.0 - uTime * 1.8, uTime * 0.4));
        float flame = clamp(n * 1.6 - vUv.y * 0.9 + 0.35, 0.0, 1.0);
        vec3 col = mix(vec3(0.6, 0.05, 0.0), vec3(1.0, 0.45, 0.05), smoothstep(0.2, 0.6, flame));
        col = mix(col, vec3(1.6, 1.3, 0.8), smoothstep(0.7, 1.0, flame));
        float a = smoothstep(0.05, 0.3, flame) * uIntensity;
        gl_FragColor = vec4(col * (0.55 + vBillow * 0.5) * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// ---------------------------------------------------------------------------
// SCAN PULSE — the robot's sonar ping. An expanding sphere whose Fresnel rim
// and procedural latitude rings fade out as uProgress goes 0 → 1.
// ---------------------------------------------------------------------------
export function createScanPulseMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 1 },
      uColor: { value: new THREE.Color(0x37c8ff) }
    },
    vertexShader: WORLD_VERTEX,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vPosW;
      varying vec3 vNormalW;
      void main() {
        vec3 V = normalize(cameraPosition - vPosW);
        float rim = pow(1.0 - abs(dot(normalize(vNormalW), V)), 3.0);
        float rings = smoothstep(0.85, 1.0, sin(vUv.y * 120.0) * 0.5 + 0.5);
        float a = (rim * 0.8 + rings * 0.12) * (1.0 - uProgress) * (1.0 - uProgress);
        gl_FragColor = vec4(uColor * a * 2.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

// ---------------------------------------------------------------------------
// DISSOLVE — injected into a built-in MeshStandardMaterial with
// onBeforeCompile, so fallen debris keeps full PBR lighting while it burns
// away along a noise threshold with a glowing ember edge.
// ---------------------------------------------------------------------------
export function applyDissolve(material, edgeColor = new THREE.Color(1.0, 0.45, 0.1)) {
  const uniforms = {
    uDissolve: { value: 0 },
    uEdgeColor: { value: edgeColor }
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uniforms.uDissolve;
    shader.uniforms.uEdgeColor = uniforms.uEdgeColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDissolvePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDissolvePos = position * 2.5;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uDissolve;
        uniform vec3 uEdgeColor;
        varying vec3 vDissolvePos;
        float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float dNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float dn = dNoise(vDissolvePos);
        if (dn < uDissolve) discard;
        totalEmissiveRadiance += uEdgeColor * smoothstep(uDissolve + 0.08, uDissolve, dn) * 4.0 * step(0.001, uDissolve);`);
  };
  material.customProgramCacheKey = () => 'dissolve';
  material.userData.dissolve = uniforms;
  return uniforms;
}
