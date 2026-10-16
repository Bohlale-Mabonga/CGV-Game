// Everything in the game that the team did not make from scratch, with
// sources and licences — shown on the in-game Credits screen.
// Only list resources that were actually used or consulted.

export const CREDITS = [
  {
    heading: 'Core Breach — the team',
    items: [
      { name: 'Kuhle Bikitsha · Thato Chuene · Ntobeko Mdakane · Nkosinathi Tshabalala · Olwethu Makhabane · Bohlale Mabonga', note: 'COMS3006A Computer Graphics and Visualisation, University of the Witwatersrand.' },
      { name: 'Original work by the team', note: 'Gameplay code, level design, custom GLSL shaders (reactor core, hologram, UV ink, steam particles, scanner beam, energy flow, force field, lava, nebula sky, fire wall, scan pulse, dissolve, Station FX post-process), procedural textures, procedurally synthesised music & sound effects, and the SPARK robot model — built in Blender 5.2 from our own Python script (tools/blender/build_spark.py) and exported as glTF.' }
    ]
  },
  {
    heading: 'Development assistance',
    items: [
      { name: 'Claude (Anthropic)', by: 'AI coding assistant', url: 'https://www.anthropic.com/claude', note: 'Used during development to help write and review code, debug, test in the browser, and draft documentation.' }
    ]
  },
  {
    heading: 'Libraries & packages',
    items: [
      { name: 'three.js r185', by: 'three.js authors (mrdoob et al.)', licence: 'MIT', url: 'https://threejs.org', note: 'Scene graph, rendering, materials, lights and shadows.' },
      { name: 'three.js add-ons: EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, Reflector, RoundedBoxGeometry, GLTFLoader, BufferGeometryUtils, RoomEnvironment', by: 'three.js authors', licence: 'MIT', url: 'https://github.com/mrdoob/three.js/tree/dev/examples/jsm' },
      { name: 'Vite', by: 'Evan You & Vite contributors', licence: 'MIT', url: 'https://vitejs.dev', note: 'Development server and production build.' },
      { name: 'Fontsource', by: 'Fontsource contributors', licence: 'MIT', url: 'https://fontsource.org', note: 'Packages the fonts so they are bundled with the game (no CDN needed).' },
      { name: 'glTF-Blender-IO', by: 'The Khronos Group & contributors', licence: 'Apache 2.0', url: 'https://github.com/KhronosGroup/glTF-Blender-IO', note: "Blender's glTF exporter, used to export the SPARK model as .glb." }
    ]
  },
  {
    heading: 'Fonts',
    items: [
      { name: 'Orbitron', by: 'Matt McInerney', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Orbitron' },
      { name: 'Rajdhani', by: 'Indian Type Foundry', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Rajdhani' }
    ]
  },
  {
    heading: 'Code adapted',
    items: [
      { name: 'webgl-noise (3D simplex noise in GLSL)', by: 'Ashima Arts & Stefan Gustavson', licence: 'MIT', url: 'https://github.com/ashima/webgl-noise', note: 'Our snoise() function, used by most of our shaders.' },
      { name: '"Hash without Sine" (hash12)', by: 'David Hoskins', licence: 'MIT', url: 'https://www.shadertoy.com/view/4djSRW', note: 'Small GLSL hash used for stars, grain and glitch effects.' }
    ]
  },
  {
    heading: 'Techniques & articles',
    items: [
      { name: 'fBm (fractal Brownian motion)', by: 'Inigo Quilez', url: 'https://iquilezles.org/articles/fbm/', note: 'Layered noise used by the core, lava, nebula and fire shaders.' },
      { name: 'Domain warping', by: 'Inigo Quilez', url: 'https://iquilezles.org/articles/warp/', note: 'Swirling plasma in the reactor core and the lava.' },
      { name: 'The Book of Shaders — Fractal Brownian Motion', by: 'Patricio Gonzalez Vivo & Jen Lowe', url: 'https://thebookofshaders.com/13/', note: 'Background on noise and fBm in fragment shaders.' },
      { name: '"A Tale of Two Clocks" — scheduling Web Audio with precision', by: 'Chris Wilson', url: 'https://web.dev/articles/audio-scheduling', note: 'The look-ahead scheduler pattern used by our music sequencer.' },
      { name: '"Math for Game Programmers: Juicing Your Cameras With Math" (GDC 2016)', by: 'Squirrel Eiserloh', url: 'https://www.gdcvault.com/play/1023557', note: 'Trauma-based camera shake.' }
    ]
  },
  {
    heading: 'three.js documentation & examples consulted',
    items: [
      { name: 'three.js documentation', by: 'three.js authors', url: 'https://threejs.org/docs/' },
      { name: 'Manual: Post-processing', url: 'https://threejs.org/manual/#en/post-processing', note: 'EffectComposer pass chain.' },
      { name: 'Manual: Shadows', url: 'https://threejs.org/manual/#en/shadows', note: 'Shadow maps and shadow cameras.' },
      { name: 'Manual: How to dispose of objects', url: 'https://threejs.org/manual/#en/how-to-dispose-of-objects', note: 'Freeing GPU memory between levels.' },
      { name: 'ShaderMaterial reference', url: 'https://threejs.org/docs/#api/en/materials/ShaderMaterial', note: 'Uniforms, attributes and built-in shader variables.' },
      { name: 'Example: Unreal bloom', url: 'https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html' },
      { name: 'Example: Mirror (Reflector)', url: 'https://threejs.org/examples/webgl_mirror.html', note: 'The Level 2 mirror floor.' },
      { name: 'Example: Cube-map refraction', url: 'https://threejs.org/examples/webgl_materials_cubemap_refraction.html', note: 'The refracting dock window.' },
      { name: 'Example: Custom attributes on points', url: 'https://threejs.org/examples/webgl_custom_attributes_points.html', note: 'Per-particle attributes for the GPU steam.' },
      { name: 'Example: Modified material (onBeforeCompile)', url: 'https://threejs.org/examples/webgl_materials_modified.html', note: 'Injecting the dissolve effect into a built-in material.' },
      { name: 'Example: glTF loader', url: 'https://threejs.org/examples/webgl_loader_gltf.html', note: 'Loading the SPARK model.' }
    ]
  },
  {
    heading: 'Web platform documentation',
    items: [
      { name: 'MDN — Web Audio API', by: 'Mozilla & contributors', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API', note: 'Synthesised music and sound effects.' },
      { name: 'MDN — PannerNode', url: 'https://developer.mozilla.org/en-US/docs/Web/API/PannerNode', note: '3D positional sound.' },
      { name: 'MDN — OfflineAudioContext', url: 'https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext', note: 'Rendering the trailer soundtrack.' },
      { name: 'MDN — Pointer Lock API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API', note: 'Mouse look.' },
      { name: 'MDN — Web Speech API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API', note: "ARIA's voice." },
      { name: 'MDN — Canvas API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API', note: 'Procedural textures, signs and screens.' },
      { name: 'OpenGL ES 3.0 / GLSL ES reference pages', by: 'The Khronos Group', url: 'https://registry.khronos.org/OpenGL-Refpages/es3.0/', note: 'GLSL built-in functions.' }
    ]
  },
  {
    heading: 'Tools',
    items: [
      { name: 'Blender 5.2', by: 'Blender Foundation', licence: 'GPL (tool only; the model is our own work)', url: 'https://www.blender.org' },
      { name: 'Blender Python API documentation', by: 'Blender Foundation', url: 'https://docs.blender.org/api/current/', note: 'Scripting the SPARK model.' },
      { name: 'Vite — Deploying a static site', url: 'https://vite.dev/guide/static-deploy', note: "Relative base ('./') for hosting in a sub-folder." }
    ]
  },
  {
    heading: 'Trailer & documentation production',
    items: [
      { name: 'Chrome DevTools Protocol', by: 'Google', url: 'https://chromedevtools.github.io/devtools-protocol/', note: 'Automated browser testing and trailer frame capture.' },
      { name: 'FFmpeg', by: 'FFmpeg developers', licence: 'LGPL/GPL', url: 'https://ffmpeg.org', note: 'Trailer audio mixing and video encoding.' },
      { name: 'Windows speech voices (Microsoft Mark & Zira)', by: 'Microsoft', url: 'https://learn.microsoft.com/en-us/uwp/api/windows.media.speechsynthesis', note: 'Trailer narration (narrator and ARIA).' },
      { name: 'Astro Starlight', by: 'The Astro team', licence: 'MIT', url: 'https://starlight.astro.build', note: 'The documentation website.' }
    ]
  },
  {
    heading: 'Browser features',
    items: [
      { name: 'Web Audio API', note: 'All music and sound effects are synthesised live — the game ships no audio files.' },
      { name: 'Web Speech API (speechSynthesis)', note: "ARIA's in-game voice uses the browser's built-in text-to-speech. It can be turned off in Options." }
    ]
  }
];
