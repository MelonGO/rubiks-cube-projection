import { CubeState, rotateVec } from './cubeState.js';
import { CENTERS, DOT_RADIUS, ringRadius, slotPosition } from './projectionGeometry.js';

export const COLORS = {
  L: '#DA3620',
  U: '#F6B33E',
  B: '#13438C',
  F: '#2D6E4C',
  R: '#ED8230',
  D: '#FEFDFA',
};

const RING_COLOR = '#9A968F';
const ACTIVE_RING_COLOR = '#3A3630';
const DOT_OUTLINE = '#36291F';
const HOVER_DIM_ALPHA = 0.22;
const TRAIL_MS = 320;
const HIGHLIGHT_FADE_MS = 260;

const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/**
 * Make all dots of a group (one ring, or the 8 outer dots of a face) travel
 * the same way round, each by the same number of slots. Slots on a ring are
 * unevenly spaced, so a quarter turn (3 of 12 slots on a ring, 2 of 8 around a
 * face center) can sweep more than 180 degrees for some dots.
 */
function orientGroup(g) {
  const angles = g.map((seg) => seg.phi0).sort((a, b) => a - b);
  const index = (phi) => angles.reduce((best, a, i) => (Math.abs(wrap(a - phi)) < Math.abs(wrap(angles[best] - phi)) ? i : best), 0);
  const n = g.length;
  const shifts = g.map((seg) => (((index(seg.phi1) - index(seg.phi0)) % n) + n) % n);
  const consistent = shifts.every((sh) => sh === shifts[0]) && shifts[0] !== 0 && shifts[0] * 2 !== n;
  const sgn = consistent
    ? shifts[0] * 2 < n ? 1 : -1
    : Math.sign(g.reduce((acc, seg) => acc + seg.dphi, 0)) || 1;
  for (const seg of g) {
    seg.consistent = consistent;
    seg.dphi = sgn > 0 ? (((seg.phi1 - seg.phi0) % TAU) + TAU) % TAU : -((((seg.phi0 - seg.phi1) % TAU) + TAU) % TAU);
  }
}

/**
 * Precompute how each moving dot travels during a turn. A turn is split into
 * quarter-turn steps; for every step a dot either slides along its slice ring
 * (constant radius about the ring center) or, for stickers on the turning face,
 * swirls about the face-center dot (polar interpolation).
 */
export function planTurn(state, axis, layers, dir) {
  const moving = state.stickers.filter((s) => CubeState.inTurn(s, axis, layers));
  const steps = [];
  let cur = moving.map((s) => ({ id: s.id, pos: s.pos, normal: s.normal }));
  for (let step = 0; step < 2; step++) {
    const segs = new Map();
    const groups = new Map();
    const next = cur.map((s) => ({
      id: s.id,
      pos: rotateVec(s.pos, axis, dir),
      normal: rotateVec(s.normal, axis, dir),
    }));
    cur.forEach((s, i) => {
      const n = next[i];
      const from = slotPosition(s.pos, s.normal);
      const to = slotPosition(n.pos, n.normal);
      const onFace = s.normal[axis] !== 0;
      const center = onFace ? slotPosition(s.normal, s.normal) : CENTERS[axis];
      const r0 = Math.hypot(from[0] - center[0], from[1] - center[1]);
      const r1 = Math.hypot(to[0] - center[0], to[1] - center[1]);
      const phi0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
      const phi1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
      const seg = { center, r0, r1, phi0, phi1, dphi: wrap(phi1 - phi0), still: r0 < 1e-6 };
      segs.set(s.id, seg);
      if (seg.still) return;
      const gk = onFace ? `f${s.normal}` : `r${s.pos[axis]}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push(seg);
    });
    for (const g of groups.values()) orientGroup(g);
    steps.push(segs);
    cur = next;
  }
  return steps;
}

export class Projection2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = null;
    this.turn = null; // { axis, layers, dir, f, key, steps }
    this.trails = new Map();
    this.highlight = null; // { axis, layers, until }
    this.hoveredFace = null;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The diagram spans about 3.7s horizontally and 3.55s vertically.
    this.s = Math.min(rect.width / 4.1, rect.height / 3.95);
    this.ox = rect.width / 2;
    this.oy = rect.height / 2 + 0.144 * this.s;
  }

  setState(state) {
    this.state = state;
  }

  setHoveredFace(normal) {
    this.hoveredFace = normal;
  }

  /** Show `layers` of `axis` turned by f quarter turns (0..2) in direction dir. */
  setTurn(axis, layers, dir, f) {
    const key = `${axis}|${layers}|${dir}`;
    if (!this.turn || this.turn.key !== key) {
      this.turn = { axis, layers, dir, key, steps: planTurn(this.state, axis, layers, dir) };
    }
    this.turn.f = Math.max(0, Math.min(2, f));
  }

  clearTurn() {
    if (this.turn) {
      this.highlight = { axis: this.turn.axis, layers: this.turn.layers, until: performance.now() + HIGHLIGHT_FADE_MS };
    }
    this.turn = null;
  }

  toScreen(p) {
    return [this.ox + p[0] * this.s, this.oy + p[1] * this.s];
  }

  dotPosition(sticker) {
    const t = this.turn;
    if (t && CubeState.inTurn(sticker, t.axis, t.layers)) {
      const step = Math.min(Math.floor(t.f), 1);
      const frac = t.f - step;
      const seg = t.steps[step].get(sticker.id);
      if (seg.still) return seg.center;
      const r = seg.r0 + (seg.r1 - seg.r0) * frac;
      const phi = seg.phi0 + seg.dphi * frac;
      return [seg.center[0] + r * Math.cos(phi), seg.center[1] + r * Math.sin(phi)];
    }
    return slotPosition(sticker.pos, sticker.normal);
  }

  draw(now = performance.now()) {
    const { ctx, s } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.state) return;

    // rings
    ctx.lineWidth = Math.max(1.5, 0.026 * s);
    ctx.strokeStyle = RING_COLOR;
    for (let axis = 0; axis < 3; axis++) {
      for (const k of [-1, 0, 1]) this.strokeRing(axis, k);
    }

    // active rings (dark while turning, fading out afterwards)
    let active = null;
    let alpha = 1;
    if (this.turn) active = this.turn;
    else if (this.highlight && now < this.highlight.until) {
      active = this.highlight;
      alpha = (this.highlight.until - now) / HIGHLIGHT_FADE_MS;
    }
    if (active) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ACTIVE_RING_COLOR;
      ctx.lineWidth = Math.max(2, 0.03 * s);
      for (const k of active.layers) this.strokeRing(active.axis, k);
      ctx.restore();
    }

    // positions + trails
    const positions = this.state.stickers.map((st) => this.toScreen(this.dotPosition(st)));
    if (this.turn) {
      this.state.stickers.forEach((st, i) => {
        if (!CubeState.inTurn(st, this.turn.axis, this.turn.layers)) return;
        let trail = this.trails.get(st.id);
        if (!trail) this.trails.set(st.id, (trail = []));
        trail.push({ x: positions[i][0], y: positions[i][1], t: now });
      });
    }
    this.drawTrails(now);

    // dots
    const r = DOT_RADIUS * s;
    const onHoveredFace = this.hoveredFace && this.state.stickers.map((st) =>
      st.normal.every((value, axis) => value === this.hoveredFace[axis]));
    ctx.save();
    ctx.lineWidth = Math.max(1.2, 0.02 * s);
    ctx.strokeStyle = DOT_OUTLINE;
    // draw moving dots last so they pass over the static ones
    const order = this.state.stickers.map((st, i) => i);
    if (this.turn) {
      const moving = (i) => CubeState.inTurn(this.state.stickers[i], this.turn.axis, this.turn.layers);
      order.sort((a, b) => moving(a) - moving(b));
    } else if (onHoveredFace) {
      order.sort((a, b) => onHoveredFace[a] - onHoveredFace[b]);
    }
    for (const i of order) {
      ctx.globalAlpha = onHoveredFace && !onHoveredFace[i] ? HOVER_DIM_ALPHA : 1;
      const [x, y] = positions[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = COLORS[this.state.stickers[i].color];
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  strokeRing(axis, k) {
    const [cx, cy] = this.toScreen(CENTERS[axis]);
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, ringRadius(k) * this.s, 0, TAU);
    this.ctx.stroke();
  }

  drawTrails(now) {
    const { ctx, s } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [id, trail] of this.trails) {
      while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
      if (trail.length < 2) {
        if (!trail.length) this.trails.delete(id);
        continue;
      }
      ctx.strokeStyle = COLORS[this.state.stickers[id].color];
      for (let i = 1; i < trail.length; i++) {
        const life = 1 - (now - trail[i].t) / TRAIL_MS;
        ctx.globalAlpha = 0.32 * life * life;
        ctx.lineWidth = DOT_RADIUS * s * (0.5 + 0.9 * life);
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
