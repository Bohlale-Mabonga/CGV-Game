---
title: Audio
---

# Audio (`engine/audio.js`)

All music and sound effects are **synthesised live with the Web Audio API**. The game ships no audio files.

## Mixing

- **Channels:** master → compressor → speakers. Music and effects have separate volume channels, controlled from the Options menu.
- **Reverb:** a convolver with a generated decaying-noise impulse gives the station its space.
- **Echo:** a delay with feedback on the music.

## Adaptive music

- **Scheduling:** a look-ahead scheduler ("A Tale of Two Clocks", Chris Wilson) wakes every 25 ms and schedules notes slightly ahead on the audio clock, so timing stays exact even if a frame stutters.
- **One track per state:** menu, three levels, victory and game over. Tracks crossfade when the state changes.
- **Instruments:** pads, drones, bass, plucks, bells, stabs and drums (kick, snare, hats), all built from oscillators, filters and noise.
- **Intensity:** each level's track takes an intensity value from 0 to 1 that adds layers as tension rises:

  | Level | Intensity rises when… |
  |---|---|
  | 1 | Steam vents are about to fire nearby (a heartbeat creeps in) |
  | 2 | The clock runs down or the sentry spots you |
  | 3 | The fire wall closes in or you approach the core |

## Sound effects

Around 40 synthesised effects, including:
- footsteps, jump, thrusters, landing
- pickups, keycards, keypad beeps
- doors, steam bursts, zaps, alarms, power surges
- falling debris, pistons, lava, the scanner ping, the seal sequence
- UI clicks

## 3D sound

Steam vents, doors, the fire wall and other effects play through HRTF `PannerNode`s. The listener follows the camera, so sounds come from where they are in the world.

## ARIA's voice

ARIA's lines use the browser's `speechSynthesis`. While she speaks, the music ducks. Subtitles are always available, and the voice can be turned off in Options.

The voice depends on the operating system. Chrome on Ubuntu may have no built-in voices, in which case ARIA speaks through subtitles only.

## Offline rendering (trailer)

`setupGraph()` can build the same mixing chain on an `OfflineAudioContext`. The trailer uses this to render its soundtrack sample-accurately (see [Trailer](/media/trailer/)).
