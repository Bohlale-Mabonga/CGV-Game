---
title: Trailer
---

# Trailer

**Watch it:** https://www.youtube.com/watch?v=N8VmOEVGrE4

The trailer is 1:50 at 1080p, 30 fps. It is made entirely from in-engine footage of the real game.

## Structure

| Time | Section |
|---|---|
| 0:00 | Cold open on the unstable core; ARIA warns of meltdown and evacuation |
| 0:08 | Empty dark corridor; "But someone has to stay behind" |
| 0:13 | SPARK boots up (visor and flashlight come on); "Meet SPARK" |
| 0:21 | Title card |
| 0:25 | Level 1: corridors, steam vents, UV-ink reveal, keycard, scanner |
| 0:40 | Level 2: crane up to the dome, hiding from the sentry, junction power-up, jump pad |
| 0:57 | Level 3: fire chase, "RUN.", double-jump over lava, pistons, pylon, plasma flare |
| 1:23 | Montage with captions |
| 1:33 | The seal: the core turns blue |
| 1:39 | End card: "One robot. One reactor. No second chances." |

## How it was made

1. **Trailer director** (`src/trailer/director.js`). Opening the game with `?trailer` stops the normal frame loop.
   - A capture script calls `__trailer.frame(i)` for each of the 3,300 frames.
   - For each frame, the director loads a fresh level when a shot needs one, positions SPARK, moves the camera, triggers real game events (vents, scanner, sentry, junction, jump pad, debris, double-jump, pistons, flares, the seal) and advances the game by exactly 1/30 s.
   - Title cards are page elements animated from the same clock.
2. **Capture.** Headless Chrome screenshots every frame over the DevTools Protocol.
3. **Score and sound effects.** The game's own synth renders the soundtrack offline (`OfflineAudioContext`), timed to the cuts.
4. **Narration.** Windows text-to-speech: Mark as the narrator, and Zira, filtered to sound metallic, as ARIA.
5. **Mix and encode** with ffmpeg:
   - processing on both voices, and the music ducking under the voice;
   - loudness normalised to about −14 LUFS, the level YouTube expects;
   - H.264 + AAC output.

Scripts and the narration cue sheet are in `tools/trailer/`.
