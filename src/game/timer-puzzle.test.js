import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { LevelTimer } from "./level2-timer.js";
import { buildPuzzleGrid } from "../world/power-puzzle.js";

describe("LevelTimer", () => {
  it("counts down until zero and then stops at zero", () => {
    const timer = new LevelTimer(5);

    timer.update(2);
    expect(timer.timeRemaining).toBeCloseTo(3, 5);

    timer.update(10);
    expect(timer.timeRemaining).toBe(0);
    expect(timer.isFinished()).toBe(true);
  });

  it("does not continue counting down after it is stopped", () => {
    const timer = new LevelTimer(8);

    timer.update(2);
    timer.stop();
    timer.update(20);

    expect(timer.timeRemaining).toBeCloseTo(6, 5);
    expect(timer.isRunning).toBe(false);
  });

  it("resets to the configured duration", () => {
    const timer = new LevelTimer(4);

    timer.update(3);
    timer.reset();

    expect(timer.timeRemaining).toBe(4);
    expect(timer.isRunning).toBe(true);
  });
});

describe("Power puzzle grid", () => {
  it("calls onSolved once when the route becomes valid after a tile rotation", () => {
    const onSolved = vi.fn();
    const interactionSystem = { register: () => {} };
    const models = {
      straight: new THREE.Object3D(),
      corner: new THREE.Object3D(),
    };

    const puzzle = buildPuzzleGrid({
      interactionSystem,
      models,
      layout: [
        [
          { type: "straight", rotation: 0 },
          { type: "straight", rotation: 1 },
        ],
      ],
      originX: 0,
      originZ: 0,
      tileSize: 1,
      source: { row: 0, col: 0, side: "W" },
      target: { row: 0, col: 1, side: "E" },
      onChange: () => {},
    });

    puzzle.onSolved(onSolved);
    const firstCell = puzzle.cells[0];
    firstCell.mesh.userData.onInteract();

    expect(puzzle.isSolved()).toBe(true);
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("stays unsolved until the correct route is connected", () => {
    const interactionSystem = { register: () => {} };
    const models = {
      straight: new THREE.Object3D(),
      corner: new THREE.Object3D(),
    };

    const puzzle = buildPuzzleGrid({
      interactionSystem,
      models,
      layout: [
        [
          { type: "straight", rotation: 0 },
          { type: "straight", rotation: 1 },
        ],
      ],
      originX: 0,
      originZ: 0,
      tileSize: 1,
      source: { row: 0, col: 0, side: "W" },
      target: { row: 0, col: 1, side: "E" },
    });

    expect(puzzle.isSolved()).toBe(false);

    const firstCell = puzzle.cells[0];
    firstCell.mesh.userData.onInteract();

    expect(puzzle.isSolved()).toBe(true);
  });
});
