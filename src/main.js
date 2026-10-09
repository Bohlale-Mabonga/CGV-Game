// CORE BREACH — entry point.
// Boots the renderer, UI and input, generates assets behind a loading screen,
// then hands control to the Game's main loop.

import './style.css';
import { Engine } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';

async function boot() {
  const ui = new UI(document.querySelector('#ui'));
  ui.setLoading(0.02, 'Booting maintenance unit…');

  let engine;
  try {
    engine = new Engine(document.querySelector('#app'));
  } catch (error) {
    ui.setLoading(0, 'WebGL 2 is required. Please use an up-to-date Chrome.');
    console.error(error);
    return;
  }
  const input = new Input(engine.canvas);
  const game = new Game({ engine, ui, input });
  window.__game = game; // handy for debugging in the console

  // Fonts are drawn into canvas textures (signs, screens), so wait for them.
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    await Promise.all([
      document.fonts.load('700 40px Orbitron'),
      document.fonts.load('700 40px Rajdhani')
    ]);
  } catch {
    /* fall back to system fonts */
  }

  await game.init((fraction, text) => ui.setLoading(fraction, text));
  game.showMainMenu();
  ui.hideLoading();

  // ?trailer — hand the frame clock to the cinematic trailer director instead.
  if (new URLSearchParams(location.search).has('trailer')) {
    const { setupTrailer } = await import('./trailer/director.js');
    await setupTrailer(game);
    return;
  }

  let last = performance.now();
  engine.renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    game.update(dt);
    engine.render();
    engine.adapt(dt);
    input.endFrame();
  });
}

boot();
