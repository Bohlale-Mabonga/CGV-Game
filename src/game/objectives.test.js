import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { ObjectiveTracker } from "./objectives.js";
import { LevelTimer } from "./level2-timer.js";
import { createKeycard, createDoor } from "../world/interactables.js";
import { buildPuzzleGrid, openPorts } from "../world/power-puzzle.js";
import {
  createSecurityBeam,
  checkSecurityBeamHit,
} from "../world/security-beam.js";
import { createSteamVent, checkSteamVentHit } from "../world/steam-vent.js";
import {
  createCollapseChunk,
  checkCollapseHit,
  updateCollapseSequence,
} from "../world/collapse-sequence.js";

describe("ObjectiveTracker", () => {
  it("collects keycards and completes the objective at the required total", () => {
    const tracker = new ObjectiveTracker(3);

    tracker.collectKeycard();
    tracker.collectKeycard();
    expect(tracker.isObjectiveComplete()).toBe(false);

    tracker.collectKeycard();
    expect(tracker.keycardsCollected).toBe(3);
    expect(tracker.isObjectiveComplete()).toBe(true);
  });

  it("notifies listeners when the keycard total changes", () => {
    const tracker = new ObjectiveTracker(2);
    let calls = 0;

    tracker.onChange = () => {
      calls += 1;
    };

    tracker.collectKeycard();
    tracker.collectKeycard();

    expect(calls).toBe(2);
  });
});

describe("LevelTimer", () => {
  it("counts down over time and stops at zero", () => {
    const timer = new LevelTimer(10);

    timer.update(3.5);
    expect(timer.timeRemaining).toBeCloseTo(6.5, 5);
    expect(timer.isFinished()).toBe(false);

    timer.update(7);
    expect(timer.isFinished()).toBe(true);
    expect(timer.timeRemaining).toBe(0);
  });

  it("can be reset and stopped", () => {
    const timer = new LevelTimer(8);

    timer.update(2);
    timer.stop();
    timer.update(10);

    expect(timer.timeRemaining).toBeCloseTo(6, 5);

    timer.reset();
    expect(timer.timeRemaining).toBe(8);
    expect(timer.isRunning).toBe(true);
  });
});

describe("Interactable objects", () => {
  it("collects a keycard and removes it from the scene", () => {
    const tracker = new ObjectiveTracker(1);
    const scene = new THREE.Scene();
    const keycard = createKeycard(new THREE.Vector3(0, 0.6, 0));

    scene.add(keycard);
    keycard.userData.onInteract(tracker, scene);

    expect(tracker.keycardsCollected).toBe(1);
    expect(scene.children).not.toContain(keycard);
  });

  it("locks a door until the objective is complete and then opens it", () => {
    const tracker = new ObjectiveTracker(1);
    const door = createDoor(new THREE.Vector3(0, 1, 0));

    door.userData.onInteract(tracker);
    expect(door.userData.isOpen).toBe(false);

    tracker.collectKeycard();
    door.userData.update(tracker);
    expect(door.userData.isUnlocked).toBe(true);

    door.userData.onInteract(tracker);
    expect(door.userData.isOpen).toBe(true);
    expect(door.position.y).toBeGreaterThan(1);
  });
});

describe("Puzzle routing logic", () => {
  it("opens the correct ports for rotated tile orientations", () => {
    expect(openPorts("straight", 0)).toEqual(["N", "S"]);
    expect(openPorts("straight", 1)).toEqual(["W", "E"]);
    expect(openPorts("corner", 1)).toEqual(["E", "N"]);
  });

  it("solves when the route connects source to target and prevents further rotation once complete", () => {
    const interactionSystem = { register: () => {} };
    const models = {
      straight: new THREE.Object3D(),
      corner: new THREE.Object3D(),
    };

    const puzzle = buildPuzzleGrid({
      interactionSystem,
      models,
      layout: [[{ type: "straight", rotation: 0 }, { type: "straight", rotation: 1 }]],
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

    firstCell.mesh.userData.onInteract();
    expect(puzzle.isSolved()).toBe(true);
  });
});

describe("Security beam hazards", () => {
  it("returns the player to the checkpoint when they enter an active beam", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0.1, 0.3, 0.2);

    const beam = createSecurityBeam(new THREE.Vector3(0, 0, 0), {
      length: 4,
      arc: Math.PI / 2,
      speed: 0,
      beamRadius: 0.2,
      facing: 0,
    });

    const checkpoint = new THREE.Vector3(0, 0.4, 5);
    const hit = checkSecurityBeamHit(camera, [beam], checkpoint, 0.3);

    expect(hit).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });
});

describe("Steam vents", () => {
  it("teleports the player back to the checkpoint when an active vent is reached", () => {
    const camera = new THREE.PerspectiveCamera();
    const checkpoint = new THREE.Vector3(2, 0.4, 2);
    const vent = createSteamVent(new THREE.Vector3(0, 0, 0));

    vent.userData.isActive = true;
    camera.position.set(0.2, 0.4, 0.1);

    expect(checkSteamVentHit(camera, [vent], checkpoint)).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });
});

describe("Collapse sequence", () => {
  it("starts falling after the configured delay and blocks the player when it collapses", () => {
    const chunk = createCollapseChunk(new THREE.Vector3(0, 2.8, 0), 0.1);
    const camera = new THREE.PerspectiveCamera();
    const checkpoint = new THREE.Vector3(0, 0.4, -5);

    camera.position.set(0.3, 0, 0.1);
    updateCollapseSequence([chunk], 0.2, true);

    expect(chunk.userData.hasStarted).toBe(true);
    expect(chunk.position.y).toBeLessThan(2.8);

    chunk.userData.hasCollapsed = true;
    chunk.position.set(0, 0.35, 0);
    expect(checkCollapseHit(camera, [chunk], checkpoint)).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });
});
