import { CubeState, parseAlgorithm, parseMove } from './cubeState.js';
import { CENTERS, ringRadius, slotPosition } from './projectionGeometry.js';
import { planTurn } from './projection2d.js';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const ALL = ['U', 'D', 'R', 'L', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z'];

function ringCounts(state) {
  for (let axis = 0; axis < 3; axis++) {
    for (const k of [-1, 0, 1]) {
      const on = state.stickers.filter((s) => {
        const p = slotPosition(s.pos, s.normal);
        const d = Math.hypot(p[0] - CENTERS[axis][0], p[1] - CENTERS[axis][1]);
        return Math.abs(d - ringRadius(k)) < 1e-9;
      });
      if (on.length !== 12) return `ring axis=${axis} k=${k} holds ${on.length} dots`;
    }
  }
  return null;
}

/** Returns a list of failure messages (empty when everything passes). */
export function runSelfChecks() {
  const fails = [];
  const solved = new CubeState();
  if (solved.toFaceletString() !== SOLVED) fails.push('solved facelet string mismatch');
  if (!solved.isSolved()) fails.push('fresh cube not solved');
  if (new Set(solved.stickers.map((s) => slotPosition(s.pos, s.normal).join())).size !== 54) {
    fails.push('slots are not distinct');
  }

  for (const name of ALL) {
    const c = new CubeState();
    const m = parseMove(name);
    for (let i = 0; i < 4; i++) c.applyMove(m);
    if (!c.isSolved() || c.toFaceletString() !== SOLVED) fails.push(`${name}^4 is not identity`);
    const c2 = new CubeState().applyMove(m).applyMove(parseMove(name + "'"));
    if (!c2.isSolved()) fails.push(`${name} ${name}' is not identity`);
  }

  const c = new CubeState();
  for (const m of parseAlgorithm("R U F' L2 D B' M E' S2 x y' z2 R2 U' F B2 L' D2")) {
    c.applyMove(m);
    const bad = ringCounts(c);
    if (bad) fails.push(`after ${m.name}: ${bad}`);
    // every dot in a ring group / face group must travel the same way round
    for (const dir of [1, -1]) {
      for (const segs of planTurn(c, m.axis, m.layers, dir)) {
        for (const seg of segs.values()) {
          if (!seg.still && !seg.consistent) fails.push(`${m.name}: dots of a group do not keep their cyclic order`);
        }
      }
    }
  }
  return fails;
}
