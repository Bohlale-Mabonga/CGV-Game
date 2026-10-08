---
title: Testing Strategy
---

# Testing Strategy

## Automated browser tests

The production build is served locally (`npx vite preview`). Chrome is then driven headlessly through the **Chrome DevTools Protocol**, using a small dependency-free Node script.

**What the script can do:**
- load the page and run commands inside it (start a level, teleport the player, trigger events);
- press real keys;
- take screenshots;
- record console errors, exceptions and failed requests (404s).

**What we test this way:**
- **Visuals:** a screenshot tour of every area of every level, plus the menus, results screens and modals.
- **Level flows:** keycards → card reader → door → lift → level complete; junctions in order → routing grid → force field → lift; pylons → bridge → seal → victory.
- **Controls:** real key events for movement, wall collision, jumping, view toggle, hints and the scanner.
- **Performance:** frame rate per level and per feature (bloom, mirror floor, sky, minimap), to find what costs the most.
- **Memory:** load the levels repeatedly and check that geometry and texture counts return to the same values.
- **Deployment:** serve the actual upload zip from a sub-folder (like the LAMP server) and check that every request returns 200 and all levels load.

These tests ran on an Intel Iris Xe GPU, a reasonable stand-in for lab hardware.

## Manual testing

These need a person at a real browser, because headless Chrome can't lock the mouse or judge how the game feels:
- mouse look and pointer lock (Esc → pause → Resume)
- holding E on junctions, pylons and the seal
- jump timing on the Level 1 crates and catwalk and on the Level 3 platforms
- difficulty balance
- a full playthrough on the published URL with the console open
