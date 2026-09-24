// p5 renderer for the 2D projection (9 rings, 54 dots). Deterministic: every
// visual (including dot trails) is derived from the video time only.

import { CubeState } from '../src/cubeState.js';
import { COLORS } from '../src/projection2d.js';
import { CENTERS, DOT_RADIUS, ringRadius } from '../src/projectionGeometry.js';
import { cubeAt, dotPosition } from './cubeAtTime.js';

export const INK = [58, 54, 48];
const RING = [154, 150, 143];
const OUTLINE = [54, 41, 31];
const TRAIL_S = 0.26;
const TRAIL_SAMPLES = 14;
const RING_FADE_S = 0.3;

export const toScreen = (view, p) => [view.cx + p[0] * view.s, view.cy + p[1] * view.s];

/**
 * opts:
 *  alpha       overall opacity
 *  ringSweep   0..1, rings drawn as growing arcs (intro)
 *  ringAlpha   opacity of the idle rings
 *  rings       extra highlighted rings [{ axis, k, a, color? }]
 *  dotAlpha    (sticker) => opacity multiplier
 *  dotScale    (sticker) => radius multiplier
 *  dotFrom     (sticker) => { p: [x, y] start position, u: 0..1 progress } for fly-in
 */
export function draw2D(p, t, view, opts = {}) {
  const { alpha = 1, ringSweep = 1, ringAlpha = 1 } = opts;
  if (alpha <= 0.001) return;
  const { state, turn, move, since } = cubeAt(t);
  const s = view.s;

  // rings
  p.noFill();
  p.strokeWeight(Math.max(1.5, 0.026 * s));
  p.stroke(...RING, 255 * alpha * ringAlpha);
  for (let axis = 0; axis < 3; axis++) {
    for (const k of [-1, 0, 1]) strokeRing(p, view, axis, k, ringSweep);
  }

  // active rings: dark while turning, fading out right after
  const active = [...(opts.rings || [])];
  if (move && move.group !== 'none') {
    const a = turn ? 1 : Math.max(0, 1 - since / RING_FADE_S);
    if (a > 0) for (const k of move.move.layers) active.push({ axis: move.move.axis, k, a });
  }
  for (const r of active) {
    p.stroke(...(r.color || INK), 255 * alpha * r.a);
    p.strokeWeight(Math.max(2, (r.w || 0.03) * s));
    strokeRing(p, view, r.axis, r.k, 1);
  }

  // positions
  const pos = state.stickers.map((st) => {
    let q = dotPosition(st, turn);
    const from = opts.dotFrom && opts.dotFrom(st);
    if (from && from.u < 1) q = [from.p[0] + (q[0] - from.p[0]) * from.u, from.p[1] + (q[1] - from.p[1]) * from.u];
    return q;
  });

  // trails of the moving dots, sampled back in time within the same move
  if (turn) {
    p.strokeCap(p.ROUND);
    for (const st of state.stickers) {
      if (!CubeState.inTurn(st, turn.axis, turn.layers)) continue;
      const da = opts.dotAlpha ? opts.dotAlpha(st) : 1;
      let prev = toScreen(view, pos[st.id]);
      const c = p.color(COLORS[st.color]);
      for (let j = 1; j <= TRAIL_SAMPLES; j++) {
        const back = cubeAt(t - (j * TRAIL_S) / TRAIL_SAMPLES);
        if (!back.turn || back.move !== move) break;
        const q = toScreen(view, dotPosition(st, back.turn));
        const life = 1 - j / TRAIL_SAMPLES;
        c.setAlpha(255 * 0.34 * life * life * alpha * da);
        p.stroke(c);
        p.strokeWeight(DOT_RADIUS * s * (0.5 + 0.9 * life));
        p.line(prev[0], prev[1], q[0], q[1]);
        prev = q;
      }
    }
  }

  // dots (moving ones on top)
  const order = state.stickers.map((st) => st.id);
  if (turn) {
    const moving = (i) => (CubeState.inTurn(state.stickers[i], turn.axis, turn.layers) ? 1 : 0);
    order.sort((a, b) => moving(a) - moving(b));
  } else if (opts.dotAlpha) {
    order.sort((a, b) => opts.dotAlpha(state.stickers[a]) - opts.dotAlpha(state.stickers[b]));
  }
  p.strokeWeight(Math.max(1.2, 0.02 * s));
  for (const i of order) {
    const st = state.stickers[i];
    const da = (opts.dotAlpha ? opts.dotAlpha(st) : 1) * alpha;
    if (da <= 0.001) continue;
    const scale = opts.dotScale ? opts.dotScale(st) : 1;
    const [x, y] = toScreen(view, pos[i]);
    const c = p.color(COLORS[st.color]);
    c.setAlpha(255 * da);
    p.fill(c);
    p.stroke(...OUTLINE, 255 * da);
    p.circle(x, y, 2 * DOT_RADIUS * s * scale);
  }
  return { state, pos };
}

export function strokeRing(p, view, axis, k, sweep = 1) {
  const [cx, cy] = toScreen(view, CENTERS[axis]);
  const d = 2 * ringRadius(k) * view.s;
  if (sweep >= 0.999) p.circle(cx, cy, d);
  else if (sweep > 0) {
    const a0 = -Math.PI / 2 + axis * 0.7 + k * 0.4;
    p.arc(cx, cy, d, d, a0, a0 + sweep * Math.PI * 2);
  }
}
