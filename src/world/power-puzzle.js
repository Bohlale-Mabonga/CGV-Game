import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// Compass in world space: N = -Z, E = +X.
// Grid rows grow toward -Z (see buildPuzzleGrid), so "north" of a cell is row + 1.
const STEP = { N: [1, 0], E: [0, 1], S: [-1, 0], W: [0, -1] }; // [dRow, dCol]
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

// Three.js rotation.y is counter-clockwise seen from above, so each +90° turns
// N -> W -> S -> E. This order MUST match how the mesh is rotated.
const ROT_ORDER = ["N", "W", "S", "E"];

// Open sides of each tile model at rotation 0.
const BASE_PORTS = {
  straight: ["N", "S"],
  corner: ["S", "E"],
};

export function openPorts(type, rotation) {
  return BASE_PORTS[type].map(
    (port) => ROT_ORDER[(ROT_ORDER.indexOf(port) + rotation) % 4],
  );
}

// Flood fill from the power source. Returns the set of powered cells.
function findPowered(cells, source) {
  const powered = new Set();
  const start = cells[source.row]?.[source.col];
  if (!start || !openPorts(start.type, start.rotation).includes(source.side)) {
    return powered;
  }

  powered.add(start);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift();
    for (const port of openPorts(cell.type, cell.rotation)) {
      const [dRow, dCol] = STEP[port];
      const next = cells[cell.row + dRow]?.[cell.col + dCol];
      if (!next || powered.has(next)) continue;
      if (openPorts(next.type, next.rotation).includes(OPPOSITE[port])) {
        powered.add(next);
        queue.push(next);
      }
    }
  }
  return powered;
}

const requestFrame =
  globalThis.requestAnimationFrame ??
  ((callback) => setTimeout(() => callback(performance.now()), 16));

const cancelFrame =
  globalThis.cancelAnimationFrame ?? ((handle) => clearTimeout(handle));

// Tween that can be cancelled, so rapid clicks never fight each other.
function tweenRotationY(mesh, target, ms = 180) {
  const start = mesh.rotation.y;
  const t0 = performance.now();
  let cancelled = false;
  let frameHandle = 0;

  function step(now) {
    if (cancelled) return;
    const t = Math.min(Math.max((now - t0) / ms, 0), 1);
    const eased = 1 - Math.pow(1 - t, 3);
    mesh.rotation.y = start + (target - start) * eased;
    if (t < 1) frameHandle = requestFrame(step);
  }
  frameHandle = requestFrame(step);
  return () => {
    cancelled = true;
    cancelFrame(frameHandle);
  };
}

/**
 * source: { row, col, side } - the tile side the power enters through
 * target: { row, col, side } - the tile side that must connect to the input
 * Returns { cells, isSolved(), isPowered(cell), onSolved(fn) }
 */
export function buildPuzzleGrid({
  interactionSystem,
  models, // { straight: scene, corner: scene }
  layout, // rows x cols of { type, rotation }
  originX,
  originZ,
  tileSize = 0.5,
  source,
  target,
  onChange, // optional (poweredSet) => void, handy for lighting tiles later
}) {
  const grid = layout.map(() => []);
  const solvedListeners = [];
  let powered = new Set();
  let solved = false;

  function evaluate() {
    powered = findPowered(grid, source);

    const end = grid[target.row]?.[target.col];
    const reached =
      !!end &&
      powered.has(end) &&
      openPorts(end.type, end.rotation).includes(target.side);

    onChange?.(powered);

    if (reached) {
      if (!solved) {
        solved = true;
        solvedListeners.forEach((fn) => fn());
      }
      return;
    }

    solved = false;
  }

  layout.forEach((row, rowIdx) => {
    row.forEach((def, colIdx) => {
      const mesh = SkeletonUtils.clone(models[def.type]);
      mesh.position.set(
        originX + colIdx * tileSize,
        0.001,
        originZ - rowIdx * tileSize,
      );
      mesh.rotation.y = (def.rotation * Math.PI) / 2;

      const cell = {
        mesh,
        row: rowIdx,
        col: colIdx,
        type: def.type,
        rotation: def.rotation, // logical 0..3, updated instantly
        angle: mesh.rotation.y, // accumulated mesh angle, never wraps
        cancelTween: null,
      };

      mesh.userData = {
        type: "junction",
        onInteract: () => {
          if (solved) return;
          cell.rotation = (cell.rotation + 1) % 4;
          cell.angle += Math.PI / 2;
          cell.cancelTween?.();
          cell.cancelTween = tweenRotationY(mesh, cell.angle);
          evaluate();
        },
      };

      interactionSystem.register(mesh); // register() already calls scene.add
      grid[rowIdx][colIdx] = cell;
    });
  });

  evaluate();

  return {
    cells: grid.flat(),
    isSolved: () => solved,
    isPowered: (cell) => powered.has(cell),
    onSolved: (fn) => solvedListeners.push(fn),
  };
}
