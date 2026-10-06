import { describe, expect, it } from "vitest";
import * as THREE from "three";

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

describe("Hazard logic", () => {
  it("detects a security beam collision and sends the player back to the checkpoint", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0.1, 0.3, 0.2);

    const beam = createSecurityBeam(new THREE.Vector3(0, 0, 0), {
      length: 4,
      arc: Math.PI / 2,
      speed: 0,
      beamRadius: 0.2,
      facing: 0,
    });

    const checkpoint = new THREE.Vector3(2, 0.4, 3);
    const hit = checkSecurityBeamHit(camera, [beam], checkpoint, 0.3);

    expect(hit).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });

  it("detects a steam vent collision while the vent is active", () => {
    const camera = new THREE.PerspectiveCamera();
    const checkpoint = new THREE.Vector3(5, 0.4, 5);
    const vent = createSteamVent(new THREE.Vector3(0, 0, 0));

    vent.userData.isActive = true;
    camera.position.set(0.2, 0.4, 0.1);

    expect(checkSteamVentHit(camera, [vent], checkpoint)).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });

  it("updates a collapsing chunk after the delay and blocks the player once it drops", () => {
    const camera = new THREE.PerspectiveCamera();
    const checkpoint = new THREE.Vector3(0, 0.4, -5);
    const chunk = createCollapseChunk(new THREE.Vector3(0, 2.8, 0), 0.1);

    camera.position.set(0.3, 0, 0.1);
    updateCollapseSequence([chunk], 0.2, true);

    expect(chunk.userData.hasStarted).toBe(true);
    expect(chunk.position.y).toBeLessThan(2.8);

    chunk.userData.hasCollapsed = true;
    chunk.position.set(0, 0.35, 0);

    expect(checkCollapseHit(camera, [chunk], checkpoint)).toBe(true);
    expect(camera.position.equals(checkpoint)).toBe(true);
  });

  it("ignores hazards that are inactive or not close enough to hit", () => {
    const camera = new THREE.PerspectiveCamera();
    const checkpoint = new THREE.Vector3(10, 0.4, 10);

    const beam = createSecurityBeam(new THREE.Vector3(50, 0, 50), {
      length: 4,
      arc: Math.PI / 2,
      speed: 0,
      beamRadius: 0.2,
      facing: 0,
    });
    beam.userData.enabled = false;

    const vent = createSteamVent(new THREE.Vector3(30, 0, 30));
    vent.userData.isActive = false;

    const chunk = createCollapseChunk(new THREE.Vector3(40, 2.8, 40), 0.1);
    chunk.userData.hasCollapsed = false;

    camera.position.set(0, 0.4, 0);

    expect(checkSecurityBeamHit(camera, [beam], checkpoint)).toBe(false);
    expect(checkSteamVentHit(camera, [vent], checkpoint)).toBe(false);
    expect(checkCollapseHit(camera, [chunk], checkpoint)).toBe(false);
  });
});
