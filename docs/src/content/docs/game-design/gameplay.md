---
title: Gameplay
---

# Gameplay

## Objective Loop

Progress is tracked through an `ObjectiveTracker`, which currently tracks keycards collected in Level 1 and exposes `isObjectiveComplete()` once the requirement (3 keycards) is met. Level 2's power-routing puzzle and Level 3's core-sealing condition use their own local completion checks (correct junction order; reaching the reactor core), reported to the player through the HUD.

## HUD

A simple on-screen HUD (`src/ui/hud.js`) displays:
- The current objective description
- Keycard count (e.g. "Keycards: 2 / 3")
- The active level timer, where relevant
- A rotating status message (e.g. "Steam vent hit you - returned to checkpoint", "Press E to open door")

## Failure and Checkpoints

Rather than a single life/death system, each level uses local checkpoints, getting hit by a steam vent, security beam, or a collapsed corridor chunk returns the player to a fixed checkpoint position for that section rather than restarting the whole game. Level 2 and Level 3 additionally use countdown timers, running out resets the puzzle (Level 2) or ends the game as a loss (Level 3).

## Win Condition

Reaching the reactor core in Level 3 triggers `reactorCore.userData.seal()`, which changes the core's shader colours (from red/orange to blue/cyan) and stops the meltdown timer, ending the game as a win.
