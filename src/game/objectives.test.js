import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { ObjectiveTracker } from "./objectives.js";
import { createSecurityBeam, checkSecurityBeamHit } from "../world/security-beam.js";
import { createCollapseChunk, checkCollapseHit } from "../world/collapse-sequence.js";

describe("ObjectiveTracker", () => {
  it("collects keycards and marks the objective complete once the target is reached", () => {
    const tracker = new ObjectiveTracker(3);

    tracker.collectKeycard();
    tracker.collectKeycard();

    expect(tracker.isObjectiveComplete()).toBe(false);
    expect(tracker.keycardsCollected).toBe(2);

    tracker.collectKeycard();

    expect(tracker.isObjectiveComplete()).toBe(true);
  });
});

describe("Security beam hit detection", () => {
  it("returns the camera to the checkpoint when the player is inside a live beam", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0.1, 0.3, 0.2);

    const beam = createSecurityBeam(new THREE.Vector3(0, 0, 0), {
      length: 10,
      arc: Math.PI / 2,
      speed: 0,
      beamRadius: 0.2,
      facing: 0,
    });
    beam.userData.angle = 0;

    const checkpoint = new THREE.Vector3(0, 0.4, 10);
    const hit = checkSecurityBeamHit(camera, [beam], checkpoint, 0.25);

    expect(hit).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });
});

describe("Collapse sequence hit detection", () => {
  it("detects when a fallen corridor chunk blocks the player and resets them to the checkpoint", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0.2, 0, 0.1);

    const chunk = createCollapseChunk(new THREE.Vector3(0, 2.8, 0), 0.1);
    chunk.userData.hasCollapsed = true;
    chunk.position.set(0, 0.35, 0);

    const checkpoint = new THREE.Vector3(0, 0.4, -5);
    const hit = checkCollapseHit(camera, [chunk], checkpoint);

    expect(hit).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });
});
