// Cube state as a pure function of video time: replays the move schedule on
// the app's CubeState and reuses the app's 2D turn planner.

import { CubeState } from '../src/cubeState.js';
import { planTurn } from '../src/projection2d.js';
import { slotPosition } from '../src/projectionGeometry.js';
import { MOVES } from './timeline.js';

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** Eased 0..1 progress of t through [a, b]. */
export const ramp = (t, a, b) => ease(clamp01((t - a) / (b - a)));
/** 0 -> 1 over [a, a+fade], stays 1, 1 -> 0 over [b-fade, b]. */
export const window01 = (t, a, b, fade = 0.4) => Math.min(ramp(t, a, a + fade), 1 - ramp(t, b - fade, b));

// states[i] = state before MOVES[i]; states[MOVES.length] = final state
const states = [new CubeState()];
for (const m of MOVES) states.push(states.at(-1).clone().applyMove(m.move));
const plans = new Map();

export const finalState = () => states.at(-1);

/** { state, turn, move } at time t; turn = { axis, layers, dir, f, steps } while a move is animating. */
export function cubeAt(t) {
  let i = -1;
  for (let k = 0; k < MOVES.length && MOVES[k].t <= t; k++) i = k;
  if (i < 0) return { state: states[0], turn: null, move: null, done: 0 };
  const m = MOVES[i];
  const u = (t - m.t) / m.dur;
  if (u >= 1) return { state: states[i + 1], turn: null, move: m, since: t - m.t - m.dur, done: i + 1 };
  if (!plans.has(i)) plans.set(i, planTurn(states[i], m.move.axis, m.move.layers, Math.sign(m.move.q)));
  const turn = {
    axis: m.move.axis,
    layers: m.move.layers,
    dir: Math.sign(m.move.q),
    f: ease(u) * Math.abs(m.move.q),
    steps: plans.get(i),
  };
  return { state: states[i], turn, move: m, u, done: i };
}

/** 2D position (triangle-side units) of a sticker, mid-turn if it is moving. */
export function dotPosition(sticker, turn) {
  if (turn && CubeState.inTurn(sticker, turn.axis, turn.layers)) {
    const step = Math.min(Math.floor(turn.f), 1);
    const frac = turn.f - step;
    const seg = turn.steps[step].get(sticker.id);
    if (seg.still) return seg.center;
    const r = seg.r0 + (seg.r1 - seg.r0) * frac;
    const phi = seg.phi0 + seg.dphi * frac;
    return [seg.center[0] + r * Math.cos(phi), seg.center[1] + r * Math.sin(phi)];
  }
  return slotPosition(sticker.pos, sticker.normal);
}
