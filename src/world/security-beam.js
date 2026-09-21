import * as THREE from "three";

const DEFAULT_LENGTH = 3;
const DEFAULT_ARC = Math.PI / 3; // total sweep width, in radians
const DEFAULT_SPEED = 0.5; // radians/sec
const DEFAULT_HEIGHT = 0.3; // must match the player's eye/collision height
const DEFAULT_BEAM_RADIUS = 0.005;

export function createSecurityBeam(
  position,
  {
    length = DEFAULT_LENGTH,
    arc = DEFAULT_ARC,
    speed = DEFAULT_SPEED,
    height = DEFAULT_HEIGHT,
    beamRadius = DEFAULT_BEAM_RADIUS,
    facing = 0,
  } = {},
) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = facing;

  // turret housing
  const emitter = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1c0f0f,
      emissive: 0xff3344,
      emissiveIntensity: 0.8,
    }),
  );
  emitter.position.y = height;
  group.add(emitter);

  const pivot = new THREE.Group();
  pivot.position.y = height;
  group.add(pivot);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(beamRadius, beamRadius, length, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.75,
    }),
  );
  beam.rotation.x = Math.PI / 2;
  beam.position.z = length / 2; // pivot sits at the emitter end, not the middle
  pivot.add(beam);

  const light = new THREE.PointLight(0xff3344, 1.2, 3);
  light.position.y = height;
  group.add(light);

  const startAngle = -arc / 2;
  pivot.rotation.y = startAngle;

  group.userData.length = length;
  group.userData.beamRadius = beamRadius;
  group.userData.height = height;
  group.userData.angle = startAngle;
  group.userData.minAngle = startAngle;
  group.userData.maxAngle = startAngle + arc;
  group.userData.speed = speed;
  group.userData.dir = 1;

  group.userData.update = (delta) => {
    const d = group.userData;
    d.angle += d.speed * d.dir * delta;

    if (d.angle > d.maxAngle) {
      d.angle = d.maxAngle;
      d.dir = -1;
    } else if (d.angle < d.minAngle) {
      d.angle = d.minAngle;
      d.dir = 1;
    }

    pivot.rotation.y = d.angle;
  };

  return group;
}

// --- hit detection -------------------------------------------------------

function getBeamEndpoints(beamGroup) {
  const { height, length, angle } = beamGroup.userData;

  const origin = new THREE.Vector3(
    beamGroup.position.x,
    beamGroup.position.y + height,
    beamGroup.position.z,
  );

  const totalAngle = beamGroup.rotation.y + angle; // mount rotation + current sweep angle
  const dir = new THREE.Vector3(Math.sin(totalAngle), 0, Math.cos(totalAngle));
  const end = origin.clone().addScaledVector(dir, length);

  return { origin, end };
}

// closest distance from a point to a line segment, measured in the XZ plane
function distancePointToSegmentXZ(point, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = point.x - a.x;
  const apz = point.z - a.z;

  const abLenSq = abx * abx + abz * abz;
  let t = abLenSq === 0 ? 0 : (apx * abx + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const dx = point.x - (a.x + abx * t);
  const dz = point.z - (a.z + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

export function checkSecurityBeamHit(
  camera,
  securityBeams,
  checkpointPosition,
  hitMargin = 0.25,
) {
  const playerPos = camera.position;

  for (const beamGroup of securityBeams) {
    const beamHeight = beamGroup.userData.height;

    if (Math.abs(playerPos.y - beamHeight) > 1.0) continue;

    const { origin, end } = getBeamEndpoints(beamGroup);
    const dist = distancePointToSegmentXZ(playerPos, origin, end);

    if (dist < beamGroup.userData.beamRadius + hitMargin) {
      camera.position.copy(checkpointPosition);
      console.log("Hit by security beam - returned to checkpoint");
      return true;
    }
  }

  return false;
}
