# Trailer pipeline

The trailer (`media/core-breach-trailer.mp4`, 1:50, 1080p30) is rendered from the real game.

1. **Picture.** Open the game with `?trailer`, which loads `src/trailer/director.js`.
   - The director takes over the frame clock. It runs a scripted shot list: camera moves, SPARK's movements, real game events, and title cards.
   - `trailer.mjs` (Node 22+) drives headless Chrome over the DevTools protocol on port 9222.
   - For each frame it calls `__trailer.frame(i)` and saves a screenshot. That gives 3,300 frames, captured deterministically.
2. **Score and sound effects.** `__trailer.renderSoundtrack()` renders the game's own synthesiser offline (`OfflineAudioContext`), using the cue sheet in `director.js`. `trailer.mjs --audio` saves the result as `music.wav`.
3. **Narration.** `tts.ps1` uses the Windows OneCore voices (Mark as the narrator, Zira as ARIA) to speak each line in `lines.txt` to its own WAV file.
4. **Mix and encode.** ffmpeg does the rest:
   - EQ, compression and reverb on the narrator; a filtered, metallic sound for ARIA.
   - Each line placed on its cue (the times are in the table below).
   - The music ducks under the voice, the mix is normalised to −14 LUFS, and the video is encoded as H.264 with AAC audio.

```
node trailer.mjs <outDir> 0 -1 1 --audio
```

| Time | Line |
| --- | --- |
| 1.0 | ARIA: Warning. Reactor core temperature: critical. |
| 5.6 | ARIA: All crew have evacuated. |
| 8.6 | But someone... has to stay behind. |
| 14.2 | Meet SPARK. |
| 16.0 | Small. Determined. And the station's last hope. |
| 25.6 | Explore the darkness. |
| 29.2 | Dodge the scalding steam... |
| 31.9 | and find what was never meant to be seen. |
| 35.2 | ARIA: UV ink. That must be the door code. |
| 41.4 | Restore the power... |
| 43.6 | before the clock runs out. |
| 47.4 | Stay out of sight. |
| 51.9 | ARIA: Breaker holding. Lowest load, to highest. |
| 57.6 | And when the station starts to fall apart... |
| 62.8 | run. |
| 67.3 | ARIA: Emergency thrusters unlocked. |
| 76.2 | Reach the core. |
| 78.6 | Seal it. |
| 80.6 | Save everyone. |
| 94.0 | ARIA: Seal engaged. Core temperature falling. Station... safe. |
| 101.3 | Core Breach. Play it now, in your browser. |
