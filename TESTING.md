# Testing Guide

This project uses Vitest for automated gameplay and logic testing.

## Why test this project

This game is built from a set of gameplay systems rather than a large framework. The most important checks are the rules that decide whether the player can progress, when hazards trigger, and whether the game state changes correctly.

The main areas worth testing are:

- objective tracking and keycard collection
- timer countdowns and failure states
- door unlock logic
- power-puzzle routing and solve state
- security beam hit detection
- steam vent hazard checks
- collapse-sequence checkpoint resets
- HUD status updates when gameplay state changes

## Setup

Install dependencies:

```bash
npm install
```

## Run the tests

Run the standard suite:

```bash
npm test
```

Run a specific file:

```bash
npx vitest run src/game/objectives.test.js
```

Generate a coverage report:

```bash
npm run test:coverage
```

## Test philosophy

Write tests for game rules and state transitions, not for browser-only rendering details.

Good tests in this project check:

- a timer reaches zero at the correct time
- a keycard increments the objective count exactly once
- the door remains locked until the objective is complete
- a power-puzzle route becomes solved only when the correct connection exists
- collisions with hazards return the player to the checkpoint

Avoid brittle tests that depend on animation timing, exact shader output, or unrelated DOM behaviour.

## Recommended test structure

Use one test file for a logical area of the game, for example:

- `src/game/objectives.test.js` for progression logic
- future files for timers, puzzle logic, or hazards

Each test should check one behaviour at a time with clear expectations.

## Example

```js
import { describe, expect, it } from "vitest";
import { ObjectiveTracker } from "./objectives.js";

describe("ObjectiveTracker", () => {
  it("completes once the required keycards are collected", () => {
    const tracker = new ObjectiveTracker(3);

    tracker.collectKeycard();
    tracker.collectKeycard();
    expect(tracker.isObjectiveComplete()).toBe(false);

    tracker.collectKeycard();
    expect(tracker.isObjectiveComplete()).toBe(true);
  });
});
```

## Coverage

Coverage helps confirm which gameplay systems are tested and which parts still need attention.

The project is set up to generate a V8 coverage report using:

```bash
npm run test:coverage
```

The generated report can be uploaded to Codecov or used for local QA review.

## Suggested next improvements

- add dedicated timer tests for Level 2 and Level 3 failure states
- add puzzle tests for the full grid routing pattern used in the game
- add HUD text tests for objective and timer updates
- add more edge-case tests for hazard boundary conditions

## Notes

This project is still a game prototype, so the goal is not full UI testing. The goal is to guard the rules that make the game playable and consistent.
