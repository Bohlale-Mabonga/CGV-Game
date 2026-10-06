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
import { StationFxShader } from '../shaders/postfx.js';
import { settings } from './settings.js';
import { textures } from './textures.js';

const QUALITY = {
  low: { pixelRatio: 0.75, samples: 0, bloom: false, shadowSize: 512, reflections: false, shadows: true },
  medium: { pixelRatio: 1.0, samples: 2, bloom: true, shadowSize: 1024, reflections: false, shadows: true },
  high: { pixelRatio: 1.5, samples: 4, bloom: true, shadowSize: 1024, reflections: true, shadows: true }
};

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

    this.applyQuality();
    settings.onChange((key) => {
      if (key === 'quality') this.applyQuality();
    });
    window.addEventListener('resize', () => this.resize());
  }

  get quality() {
    return QUALITY[settings.get('quality')] ?? QUALITY.high;
  }

  applyQuality() {
    const q = this.quality;
    this.resolutionScale = 1;
    this.buildComposer();
    this.renderer.shadowMap.enabled = q.shadows;
    this.resize();
    this.onQualityChange?.(q);
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
    if (this.camera?.isPerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  // Dynamic resolution: trade pixels for frame rate on slower lab machines.
  adapt(dt) {
    const a = this.adaptive;
    a.frames++;
    a.time += dt;
    if (a.time < 2) return;
    const fps = a.frames / a.time;
    a.frames = 0;
    a.time = 0;
    this.fps = fps;
    let next = this.resolutionScale;
    if (fps < 48 && next > 0.6) next = Math.max(0.6, next - 0.1);
    else if (fps > 58 && next < 1) next = Math.min(1, next + 0.05);
    if (next !== this.resolutionScale) {
      this.resolutionScale = next;
      this.resize();
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
