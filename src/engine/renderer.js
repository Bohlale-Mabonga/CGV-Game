// Renderer + post-processing pipeline.
//
//   RenderPass (MSAA, HalfFloat HDR target)
//     → UnrealBloomPass (glowing emissives, reactor core)
//     → StationFx (our own full-screen shader: heat haze, aberration, damage…)
//     → OutputPass (ACES tone mapping + sRGB conversion)
//
// After the composer, a second viewport is drawn into the top-right corner
// with an orthographic camera: the picture-in-picture tactical minimap.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { StationFxShader } from '../shaders/postfx.js';
import { settings } from './settings.js';
import { textures } from './textures.js';

// Quality tiers, from most to least demanding. `minScale` is how far the
// dynamic resolution may drop before Auto mode steps down a whole tier.
// `particles` scales steam particle counts; `fullLights` keeps decorative
// lights (otherwise only gameplay-relevant lights are created).
const QUALITY = {
  // samples: hardware MSAA (the single most expensive feature on integrated
  // GPUs). fxaa: cheap screen-space anti-aliasing used instead. bloomScale:
  // resolution of the bloom blur (0.5 = half, about half the cost).
  high: { name: 'high', pixelRatio: 1.5, samples: 4, fxaa: false, bloom: true, bloomScale: 1, shadowSize: 1024, reflections: true, shadows: true, heatHaze: true, particles: 1, fullLights: true, extraShadows: true, minScale: 0.75 },
  medium: { name: 'medium', pixelRatio: 1.0, samples: 0, fxaa: true, bloom: true, bloomScale: 0.5, shadowSize: 1024, reflections: false, shadows: true, heatHaze: true, particles: 1, fullLights: true, extraShadows: true, minScale: 0.7 },
  low: { name: 'low', pixelRatio: 1.0, samples: 0, fxaa: false, bloom: false, bloomScale: 0.5, shadowSize: 512, reflections: false, shadows: true, heatHaze: false, particles: 0.5, fullLights: false, extraShadows: false, minScale: 0.65 },
  lowest: { name: 'lowest', pixelRatio: 0.85, samples: 0, fxaa: false, bloom: false, bloomScale: 0.5, shadowSize: 512, reflections: false, shadows: true, heatHaze: false, particles: 0.35, fullLights: false, extraShadows: false, minScale: 0.5 }
};
const TIERS = ['high', 'medium', 'low', 'lowest'];
const AUTO_KEY = 'core-breach-auto-graphics';

// Guess a starting tier from the GPU name. Only known dedicated GPUs get High;
// integrated or unknown chips start at Medium; software renderers at Low.
function detectTier(renderer) {
  let name = '';
  try {
    const gl = renderer.getContext();
    name = String(gl.getParameter(gl.RENDERER) || '');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) name += ' ' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  } catch { /* ignore */ }
  const n = name.toLowerCase();
  let tier = 'medium';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(n)) tier = 'low';
  else if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d/.test(n)) tier = 'high';
  return { tier, gpu: name };
}

export class Engine {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA is done on the composer's render target instead
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    textures.setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = null;
    this.camera = null;
    this.resolutionScale = 1;
    this.adaptive = { frames: 0, time: 0 };
    this.minimap = null; // { scene, camera, visible, size }
    this.fx = null;

    const detected = detectTier(this.renderer);
    this.detectedTier = detected.tier;
    this.gpuName = detected.gpu;
    this.tier = this.tierForMode();
    this.applyQuality();
    console.info(`[Core Breach] GPU: ${this.gpuName || 'unknown'} · graphics ${settings.get('graphics')} → ${this.tier}`);
    settings.onChange((key) => {
      if (key === 'graphics') {
        this.tier = this.tierForMode();
        this.applyQuality();
        console.info(`[Core Breach] graphics ${settings.get('graphics')} → ${this.tier}`);
      }
    });
    window.addEventListener('resize', () => this.resize());
  }

  get quality() {
    return QUALITY[this.tier] ?? QUALITY.medium;
  }

  // Graphics option: Auto (detected, may step down), Performance, Quality.
  tierForMode() {
    const mode = settings.get('graphics');
    if (mode === 'quality') return 'high';
    if (mode === 'performance') return 'low';
    // Auto: start from the detected tier, or the tier Auto had to drop to last
    // time on this same GPU (so the lab doesn't stutter at every start).
    let tier = this.detectedTier;
    try {
      const saved = JSON.parse(localStorage.getItem(AUTO_KEY) || 'null');
      if (saved && saved.gpu === this.gpuName && TIERS.indexOf(saved.tier) > TIERS.indexOf(tier)) tier = saved.tier;
    } catch { /* ignore */ }
    return tier;
  }

  applyQuality() {
    const q = this.quality;
    this.resolutionScale = 1;
    this.lowStreak = 0;
    this.buildComposer();
    this.renderer.shadowMap.enabled = q.shadows;
    this.resize();
    this.onQualityChange?.(q);
  }

  // Auto mode: drop one tier (called when the frame rate stays low).
  stepDown() {
    const i = TIERS.indexOf(this.tier);
    if (i < 0 || i >= TIERS.length - 1) return false;
    this.tier = TIERS[i + 1];
    console.info(`[Core Breach] frame rate low → graphics lowered to ${this.tier}`);
    try { localStorage.setItem(AUTO_KEY, JSON.stringify({ gpu: this.gpuName, tier: this.tier })); } catch { /* ignore */ }
    this.applyQuality();
    this.onTierDrop?.(this.quality);
    return true;
  }

  buildComposer() {
    const q = this.quality;
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.bloomPass?.dispose();
    }
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: q.samples
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);

    this.bloomPass = null;
    if (q.bloom) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 1.0);
      if (q.bloomScale < 1) {
        // Blur at reduced resolution: the glow is soft anyway, so this is nearly invisible.
        const setSize = this.bloomPass.setSize.bind(this.bloomPass);
        this.bloomPass.setSize = (w, h) => setSize(Math.max(1, Math.round(w * q.bloomScale)), Math.max(1, Math.round(h * q.bloomScale)));
      }
      this.composer.addPass(this.bloomPass);
    }

    const previous = this.fxPass?.uniforms;
    this.fxPass = new ShaderPass(StationFxShader);
    if (previous) {
      for (const key of Object.keys(previous)) {
        if (key === 'tDiffuse') continue;
        const v = previous[key].value;
        this.fxPass.uniforms[key].value = v?.clone ? v.clone() : v;
      }
    }
    this.fx = this.fxPass.uniforms;
    this.composer.addPass(this.fxPass);
    this.composer.addPass(new OutputPass());
    // FXAA runs last, on the final tone-mapped image.
    this.fxaaPass = null;
    if (q.fxaa) {
      this.fxaaPass = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaaPass);
    }
    if (this.scene) this.setView(this.scene, this.camera);
  }

  setBloom(strength, threshold = 1.0, radius = 0.5) {
    if (!this.bloomPass) return;
    this.bloomPass.strength = strength;
    this.bloomPass.threshold = threshold;
    this.bloomPass.radius = radius;
  }

  setView(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio, this.quality.pixelRatio) * this.resolutionScale;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
    this.fx.uResolution.value.set(w * ratio, h * ratio);
    this.fxaaPass?.material.uniforms.resolution.value.set(1 / (w * ratio), 1 / (h * ratio));
    if (this.camera?.isPerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  // Dynamic resolution: trade pixels for frame rate on slower lab machines.
  // `active` is false outside gameplay (menus, loading, shader compiles), so
  // loading hitches never count as lag.
  adapt(dt, active = true) {
    const a = this.adaptive;
    if (!active) {
      a.frames = 0;
      a.time = 0;
      a.grace = 1.5;
      return;
    }
    if (a.grace > 0) {
      a.grace -= dt;
      return;
    }
    a.frames++;
    a.time += dt;
    if (a.time < 2) return;
    const fps = a.frames / a.time;
    a.frames = 0;
    a.time = 0;
    this.fps = fps;
    const q = this.quality;
    let next = this.resolutionScale;
    if (fps < 55 && next > q.minScale) next = Math.max(q.minScale, next - 0.1);
    else if (fps > 58 && next < 1) next = Math.min(1, next + 0.05);
    if (next !== this.resolutionScale) {
      this.resolutionScale = next;
      this.resize();
    }
    // Still slow at this tier's lowest resolution for ~4 s → step down a tier.
    if (settings.get('graphics') === 'auto' && fps < 45 && this.resolutionScale <= q.minScale + 1e-6) {
      this.lowStreak = (this.lowStreak ?? 0) + 1;
      if (this.lowStreak >= 2) {
        this.lowStreak = 0;
        if (this.stepDown()) a.grace = 2;
      }
    } else {
      this.lowStreak = 0;
    }
  }

  render() {
    if (!this.scene || !this.camera) return;
    this.composer.render();

    const mm = this.minimap;
    if (mm && mm.visible) {
      const r = this.renderer;
      const w = window.innerWidth;
      const size = mm.size;
      const margin = 16;
      const x = w - size - margin;
      const y = window.innerHeight - size - margin - (mm.offsetTop ?? 0);
      r.setRenderTarget(null);
      r.autoClear = false;
      r.setScissorTest(true);
      r.setViewport(x, y, size, size);
      r.setScissor(x, y, size, size);
      r.setClearColor(0x03101a, 0.85);
      r.clear(true, true, false);
      r.render(mm.scene, mm.camera);
      r.setScissorTest(false);
      r.setViewport(0, 0, w, window.innerHeight);
      r.setClearColor(0x000000, 1);
      r.autoClear = true;
    }
  }

  async compile(scene, camera) {
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(scene, camera);
      else this.renderer.compile(scene, camera);
    } catch {
      /* compilation will simply happen on first render */
    }
  }
}
