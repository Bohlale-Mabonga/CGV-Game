// Everything in the game that the team did not make from scratch, with
// sources and licences — shown on the in-game Credits screen.

export const CREDITS = [
  {
    heading: 'Core Breach — the team',
    items: [
      { name: 'Kuhle Bikitsha · Thato Chuene · Ntobeko Mdakane · Nkosinathi Tshabalala · Olwethu Makhabane · Bohlale Mabonga', note: 'COMS3006A Computer Graphics and Visualisation, University of the Witwatersrand.' },
      { name: 'Original work by the team', note: 'All gameplay code, level design, custom GLSL shaders (reactor core, hologram, UV ink, steam particles, scanner beam, energy flow, force field, lava, nebula sky, fire wall, scan pulse, dissolve, Station FX post-process), procedural textures, procedurally synthesised music & sound effects, and the 3D models (SPARK robot, keycard, crate) built in Blender.' }
    ]
  },
  {
    heading: 'Libraries',
    items: [
      { name: 'three.js r185', by: 'three.js authors (mrdoob et al.)', licence: 'MIT', url: 'https://threejs.org' },
      { name: 'three.js add-ons: EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, Reflector, RoundedBoxGeometry, GLTFLoader, BufferGeometryUtils, RoomEnvironment', by: 'three.js authors', licence: 'MIT', url: 'https://github.com/mrdoob/three.js/tree/dev/examples/jsm' },
      { name: 'Vite (build tool)', by: 'Evan You & Vite contributors', licence: 'MIT', url: 'https://vitejs.dev' }
    ]
  },
  {
    heading: 'Fonts',
    items: [
      { name: 'Orbitron', by: 'Matt McInerney', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Orbitron', note: 'Bundled via Fontsource (@fontsource/orbitron, MIT packaging).' },
      { name: 'Rajdhani', by: 'Indian Type Foundry', licence: 'SIL Open Font License 1.1', url: 'https://fonts.google.com/specimen/Rajdhani', note: 'Bundled via Fontsource (@fontsource/rajdhani, MIT packaging).' }
    ]
  },
  {
    heading: 'Code adapted / techniques learned from',
    items: [
      { name: 'webgl-noise (3D simplex noise GLSL)', by: 'Ashima Arts & Stefan Gustavson', licence: 'MIT', url: 'https://github.com/ashima/webgl-noise', note: 'snoise() used in several of our shaders.' },
      { name: 'hash12 GLSL hash ("Hash without Sine")', by: 'David Hoskins', licence: 'MIT', url: 'https://www.shadertoy.com/view/4djSRW' },
      { name: 'Domain warping & fBm articles', by: 'Inigo Quilez', url: 'https://iquilezles.org/articles/warp/', note: 'Technique reference for the reactor core and lava shaders.' },
      { name: '"A Tale of Two Clocks" — Web Audio scheduling', by: 'Chris Wilson', url: 'https://web.dev/articles/audio-scheduling', note: 'Look-ahead scheduler pattern used by our music sequencer.' },
      { name: 'Trauma-based screen shake', by: 'Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math" (GDC 2016)', url: 'https://www.gdcvault.com/play/1023557' },
      { name: 'three.js examples (post-processing, Reflector, shadows)', by: 'three.js authors', licence: 'MIT', url: 'https://threejs.org/examples/' }
    ]
  },
  {
    heading: 'Platform features',
    items: [
      { name: 'Web Audio API', note: 'All music and sound effects are synthesised live — no audio files.' },
      { name: 'Web Speech API (speechSynthesis)', note: "ARIA's voice uses the browser's built-in text-to-speech voices. Can be turned off in Options." },
      { name: 'Blender 5.2', by: 'Blender Foundation', licence: 'GPL (tool only; the models are our own work)', url: 'https://www.blender.org' }
    ]
  }
];
