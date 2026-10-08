---
title: Test Cases
---

# Test Cases

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Load the game | Loading screen, then the main menu with the animated reactor scene | Pass |
| 2 | New Game | Level 1 fly-through intro, then gameplay with the HUD | Pass |
| 3 | Hold W for 1.5 s | Robot moves about 6 m (4.3 m/s) | Pass |
| 4 | Walk into a wall | Robot stops at the wall and slides along it | Pass |
| 5 | Press Space | Robot rises about 1.3 m and lands back on the ground | Pass |
| 6 | V / H / Q | Camera view toggles; hint appears; scanner pulse and labels appear | Pass |
| 7 | Point the flashlight at Mira's wall | UV-ink code appears; ARIA comments; counts as a secret | Pass |
| 8 | Collect all keycards, use the card reader | Card slots light up, door opens, objective changes to the lift | Pass |
| 9 | Enter the lift | Level Complete screen with stats | Pass |
| 10 | Activate junctions in ascending load | Each goes online; cable energy flows; console unlocks at 5/5 | Pass |
| 11 | Activate a junction out of order | Surge, damage, −10 s, all junctions reset | Pass |
| 12 | Solve the routing grid | Field dissolves; lift reachable; Level Complete | Pass |
| 13 | Enter the reactor chamber | Blast door closes behind you; objective changes to pylons | Pass |
| 14 | Activate 3 pylons and seal | Bridge extends; core turns blue; victory screen with rank | Pass |
| 15 | Load levels repeatedly | Geometry and texture counts stable (no leak) | Pass |
| 16 | Serve the upload zip from a sub-folder | All requests 200; robot model loads; all levels load | Pass |
| 17 | Published URL | `index.html`, JS, CSS and model return 200 | Pass |
| 18 | Mouse look and pointer lock | Smooth look; Esc pauses; Resume re-locks | Manual test pending |
| 19 | Full playthrough on lab hardware | Acceptable frame rate, no console errors | Manual test pending |
