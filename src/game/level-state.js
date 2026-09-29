import * as THREE from "three";
import { createKeycard } from "../world/interactables.js";
import { createSecurityBeam, checkSecurityBeamHit } from "../world/security-beam.js";

const KEYCARD_POSITIONS = [
  [-5.5, 0.5, -7.5],
  [0.5, 0.5, -18.5],
  [5.5, 0.5, -14.5],
];

const BEAM_DEFS = [
  { pos: [0, 0, -27], facing: 0, arc: Math.PI / 2.2, speed: 0.225 },
  { pos: [2, 0, -25.5], facing: -Math.PI / 2, arc: Math.PI / 2.2, speed: 0.175 },
];

const CHECKPOINT = new THREE.Vector3(0, 0.4, -21);

/** Gameplay rules that sit on top of the built level. */
export function createLevelState({ scene, camera, hud, interactionSystem, objectiveTracker, level }) {
  for (const p of KEYCARD_POSITIONS) {
    interactionSystem.register(createKeycard(new THREE.Vector3(...p)));
  }

  const beams = BEAM_DEFS.map(({ pos, ...opts }) => {
    const beam = createSecurityBeam(new THREE.Vector3(...pos), opts);
    scene.add(beam);
    return beam;
  });

  level.puzzle.onSolved(() => {
    hud.setMessage("Power routed - containment online");
    // TODO: level.reactorConsole.userData.setComplete(), unlock the next section...
  });

  return {
    update(delta) {
      for (const beam of beams) beam.userData.update(delta);

      if (checkSecurityBeamHit(camera, beams, CHECKPOINT)) {
        hud.setMessage("Security beam hit you - returned to control room entrance");
      }

      if (objectiveTracker.isObjectiveComplete()) level.doors.end.open();
    },
  };
}
