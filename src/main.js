import * as THREE from 'three';
import { CubeState, OUTER_FACE_MOVES, invertMove, moveFromTurn, parseAlgorithm, parseMove } from './cubeState.js';
import { Cube3D } from './cube3d.js';
import { Projection2D } from './projection2d.js';

const MOVE_MS = 350;
const SCRAMBLE_MS = 140;
const SOLVE_MS = 240;
const HALF_PI = Math.PI / 2;

const state = new CubeState();
const cube = new Cube3D(document.getElementById('cube-panel'));
const proj = new Projection2D(document.getElementById('rings'));
proj.setState(state);
cube.syncColors(state);

const ui = {
  scramble: document.getElementById('scramble'),
  solve: document.getElementById('solve'),
  undo: document.getElementById('undo'),
  reset: document.getElementById('reset'),
  moves: document.getElementById('moves'),
  solved: document.getElementById('solved'),
};

// ---------------------------------------------------------------------------
// Move queue: one timeline drives the 3D layer and the 2D rings in lockstep.
// ---------------------------------------------------------------------------

const history = [];
const queue = []; // { move, ms }
let anim = null; // { axis, layers, dir, fFrom, fTo, start, ms }
let drag = null;
let hoverPointer = null;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const busy = () => !!anim || queue.length > 0 || (drag && drag.mode === 'turn');

function enqueue(move, { ms = MOVE_MS, record = true } = {}) {
  if (record) history.push(move);
  queue.push({ move, ms });
  updateUI();
}

function startAnim(axis, layers, dir, fFrom, fTo, ms) {
  anim = { axis, layers, dir, fFrom, fTo, ms, start: performance.now() };
}

function showTurn(axis, layers, dir, f) {
  cube.setTurn(axis, layers, dir * f * HALF_PI);
  proj.setTurn(axis, layers, dir, f);
}

function endTurn() {
  cube.clearTurn();
  proj.clearTurn();
}

function commit(move) {
  endTurn();
  state.applyMove(move);
  cube.syncColors(state);
  updateUI();
}

function step(now) {
  if (!anim && queue.length && !(drag && drag.mode === 'turn')) {
    const { move, ms } = queue.shift();
    const turns = Math.abs(move.q);
    startAnim(move.axis, move.layers, Math.sign(move.q), 0, turns, ms * (turns === 2 ? 1.5 : 1));
  }
  if (anim) {
    const t = Math.min(1, (now - anim.start) / anim.ms);
    const f = anim.fFrom + (anim.fTo - anim.fFrom) * ease(t);
    showTurn(anim.axis, anim.layers, anim.dir, f);
    if (t >= 1) {
      const { axis, layers, dir, fTo, onDone } = anim;
      anim = null;
      if (fTo > 0) commit({ axis, layers, q: dir * fTo });
      else endTurn();
      if (onDone) onDone();
      updateUI();
    }
  }
}

function loop(now) {
  step(now);
  const rect = cube.renderer.domElement.getBoundingClientRect();
  const hovering = hoverPointer && !busy() && !drag &&
    hoverPointer.x >= rect.left && hoverPointer.x < rect.right &&
    hoverPointer.y >= rect.top && hoverPointer.y < rect.bottom;
  proj.setHoveredFace(hovering ? cube.pick(hoverPointer.x, hoverPointer.y)?.normal ?? null : null);
  cube.render();
  proj.draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

let solverReady = false;
let solving = false;

function updateUI() {
  ui.moves.textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;
  const idle = !busy();
  ui.solved.classList.toggle('show', idle && state.isSolved() && history.length > 0);
  ui.solve.disabled = !solverReady || solving;
  ui.solve.textContent = !solverReady ? 'Preparing solver…' : solving ? 'Solving…' : 'Solve';
  ui.undo.disabled = history.length === 0;
}

function scramble() {
  let lastAxis = -1;
  for (let i = 0; i < 25; i++) {
    let face;
    do face = OUTER_FACE_MOVES[Math.floor(Math.random() * 6)];
    while (parseMove(face).axis === lastAxis);
    lastAxis = parseMove(face).axis;
    const suffix = ['', "'", '2'][Math.floor(Math.random() * 3)];
    enqueue(parseMove(face + suffix), { ms: SCRAMBLE_MS });
  }
}

function undo() {
  const last = history.pop();
  if (!last) return;
  enqueue(invertMove(last), { record: false });
}

function reset() {
  if (drag && drag.mode === 'turn') drag = null;
  queue.length = 0;
  anim = null;
  endTurn();
  history.length = 0;
  state.reset();
  cube.syncColors(state);
  updateUI();
}

// Solver runs in a worker: building the Kociemba tables takes a few seconds.
const worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
let solveId = 0;
worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'ready') {
    solverReady = true;
  } else if (msg.id === solveId) {
    solving = false;
    if (msg.type === 'solution') {
      for (const m of parseAlgorithm(msg.solution)) enqueue(m, { ms: SOLVE_MS });
    } else {
      console.error('solver error', msg.message);
    }
  }
  updateUI();
};

function solve() {
  if (!solverReady || solving) return;
  if (busy()) {
    // solve from the state reached once the queue has drained
    const waitIdle = () => (busy() ? requestAnimationFrame(waitIdle) : solve());
    requestAnimationFrame(waitIdle);
    return;
  }
  if (state.isSolved()) return;
  solving = true;
  worker.postMessage({ id: ++solveId, facelets: state.toFaceletString() });
  updateUI();
}

ui.scramble.addEventListener('click', scramble);
ui.solve.addEventListener('click', solve);
ui.undo.addEventListener('click', undo);
ui.reset.addEventListener('click', reset);

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const m = /^Key([UDLRFBMESXYZ])$/.exec(e.code);
  if (!m) return;
  const base = 'XYZ'.includes(m[1]) ? m[1].toLowerCase() : m[1];
  enqueue(parseMove(base + (e.shiftKey ? "'" : '')));
});

// ---------------------------------------------------------------------------
// Drag input on the 3D cube: grab a face to turn a layer, background to orbit.
// ---------------------------------------------------------------------------

const canvas3d = cube.renderer.domElement;
const DRAG_THRESHOLD = 6;
const RADIANS_PER_UNIT = 1 / 1.1;
const SNAP_THRESHOLD = 0.35; // fraction of a quarter turn needed to commit

canvas3d.addEventListener('pointerenter', (e) => {
  if (e.pointerType !== 'touch') hoverPointer = { x: e.clientX, y: e.clientY };
});

canvas3d.addEventListener('pointerdown', (e) => {
  if (drag) return;
  hoverPointer = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY };
  canvas3d.setPointerCapture(e.pointerId);
  const hit = !anim && queue.length === 0 ? cube.pick(e.clientX, e.clientY) : null;
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, hit, mode: hit ? 'pending' : 'orbit' };
});

canvas3d.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') hoverPointer = { x: e.clientX, y: e.clientY };
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (drag.mode === 'orbit') {
    cube.orbit(dx, dy);
    return;
  }
  const total = new THREE.Vector2(e.clientX - drag.x0, e.clientY - drag.y0);
  if (drag.mode === 'pending') {
    if (total.length() < DRAG_THRESHOLD) return;
    beginTurnDrag(total);
  }
  if (drag.mode === 'turn') {
    const along = total.dot(drag.screenDir) / drag.screenDir.lengthSq(); // world units along e_u
    drag.angle = drag.rotSign * along * RADIANS_PER_UNIT;
    const f = Math.min(2, Math.abs(drag.angle) / HALF_PI);
    showTurn(drag.axis, [drag.layer], Math.sign(drag.angle) || 1, f);
  }
});

function beginTurnDrag(total) {
  if (anim || queue.length) {
    drag.mode = 'orbit';
    return;
  }
  const { home, normal, point } = drag.hit;
  const n = normal.findIndex((v) => v !== 0);
  // pick the in-plane axis whose on-screen direction best matches the drag
  let best = null;
  for (const u of [0, 1, 2]) {
    if (u === n) continue;
    const dir = new THREE.Vector3();
    dir.setComponent(u, 1);
    const sd = cube.screenDirection(point, dir);
    const score = Math.abs(total.dot(sd)) / (sd.length() || 1);
    if (!best || score > best.score) best = { u, sd, score };
  }
  // moving the surface along +e_u on a face with normal N is a rotation about N x e_u
  const eu = new THREE.Vector3();
  eu.setComponent(best.u, 1);
  const w = new THREE.Vector3(...normal).cross(eu);
  const axis = [0, 1, 2].find((k) => k !== n && k !== best.u);
  Object.assign(drag, {
    mode: 'turn',
    axis,
    layer: home[axis],
    rotSign: Math.sign(w.getComponent(axis)),
    screenDir: best.sd,
    angle: 0,
  });
}

function endPointer(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (d.mode !== 'turn') return;
  const dir = Math.sign(d.angle) || 1;
  const fFrom = Math.min(2, Math.abs(d.angle) / HALF_PI);
  const fTo = fFrom - Math.floor(fFrom) > SNAP_THRESHOLD ? Math.ceil(fFrom) : Math.floor(fFrom);
  startAnim(d.axis, [d.layer], dir, fFrom, fTo, Math.max(120, Math.abs(fTo - fFrom) * MOVE_MS));
  if (fTo > 0) {
    anim.onDone = () => {
      history.push(moveFromTurn(d.axis, [d.layer], dir * fTo));
    };
  }
}
canvas3d.addEventListener('pointerup', endPointer);
canvas3d.addEventListener('pointercancel', (e) => {
  hoverPointer = null;
  endPointer(e);
});
canvas3d.addEventListener('pointerleave', () => { hoverPointer = null; });
window.addEventListener('blur', () => { hoverPointer = null; });

// ---------------------------------------------------------------------------

function resize() {
  cube.resize();
  proj.resize();
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.querySelector('.stage'));

if (import.meta.env.DEV) {
  window.__app = { cube, proj, state };
  import('./selfcheck.js').then(({ runSelfChecks }) => {
    const fails = runSelfChecks();
    if (fails.length) console.error('[selfcheck] FAIL', fails);
    else console.info('[selfcheck] all passed');
  });
}

updateUI();
