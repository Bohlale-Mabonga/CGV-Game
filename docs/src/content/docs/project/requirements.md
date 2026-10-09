---
title: Requirements
---

# Requirements

Status of each deliverable from the course brief.

| Deliverable | Status |
|---|---|
| Playable 3D game, three genuinely distinct levels | Done |
| Hosted on the department LAMP server | Done: https://wmc.ms.wits.ac.za/students/sgroup3906/ |
| Keyboard and mouse controls | Done |
| At least one custom shader | Done (13 shader materials plus a post-processing pass) |
| Restart without refreshing the page | Done (pause menu, results screens) |
| In-game credits screen | Done (Main menu → Credits) |
| Trailer video (max 2 min) | Done: 1:50, uploaded to YouTube |
| Devlog video | Final submission only |
| Individual contribution reports | Each member, on Moodle |

## Section 12 checklist

- [x] Three levels, playable from start to finish
- [x] Each level adds something the others don't (see [Overview](/project/overview/))
- [x] Keyboard and mouse controls both work
- [x] Custom shaders in the game. Every member should be able to explain them; see [Shaders](/technical/shaders/)
- [x] Restart without refreshing
- [x] Credits screen with sources and licences
- [x] Production build, not the source tree
- [x] Build tested locally over HTTP
- [x] No absolute paths (`vite.config.js` uses `base: './'`)
- [x] Asset filenames lowercase with no spaces
- [x] Archive uploaded with `index.html` at its top level
- [ ] Full playthrough on the published URL with the console checked (files already confirmed to load)
- [x] Memory doesn't climb across levels (see [Performance](/technical/performance/))
- [ ] Frame rate confirmed on a lab machine
- [x] Trailer on YouTube
- [ ] Devlog video
- [ ] Contribution reports
