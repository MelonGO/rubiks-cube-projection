// The p5.js parts of the demo video (intro, one simple idea, outro). Every
// frame is a pure function of the time t = frame / FPS, so the renderer can
// capture frames in any order.

import p5 from 'p5';
import { FACE_NORMALS } from '../src/cubeState.js';
import { COLORS } from '../src/projection2d.js';
import { slotPosition } from '../src/projectionGeometry.js';
import { clamp01, ease, ramp, window01 } from './cubeAtTime.js';
import { INK, draw2D, toScreen } from './draw2d.js';
import { create3D, draw3D } from './draw3d.js';
import { drawCaption, pill, textStyle } from './overlays.js';
import { DURATION, FACE_GLOW, FPS, H, OUTRO, W } from './timeline.js';
import { videoText } from './locale.js';

const VIEW_2D = { cx: 1370, cy: 525, s: 212 };
const PANEL_3D = { x: 60, y: 40, w: 960, h: 960 };
const CLIP_2D_X = 930;
const MUTED = [128, 123, 115];
const params = new URLSearchParams(location.search);
const lang = params.get('lang') || 'en';
const copy = videoText(lang);
const lerp = (a, b, u) => a + (b - a) * u;
const same = (a, b) => a.every((v, i) => v === b[i]);

// 3D camera: spin in during the title, then a gentle sway
function camAt(t) {
  const u = ease(clamp01(t / 3.6));
  return {
    az: lerp(Math.PI / 4 - 2.4, Math.PI / 4, u) + 0.08 * Math.sin(t * 0.45),
    el: lerp(0.55, 0.3, u) + 0.03 * Math.sin(t * 0.31),
    zoom: lerp(0.55, 1, u),
  };
}

function faceWeights(t) {
  const w = {};
  FACE_GLOW.faces.forEach((f, i) => {
    const a = FACE_GLOW.start + i * FACE_GLOW.each;
    w[f] = window01(t, a, a + FACE_GLOW.each + 0.1, 0.25);
  });
  return w;
}
const faceOf = (n) => Object.keys(FACE_NORMALS).find((f) => same(FACE_NORMALS[f], n));

function sceneSetup(t) {
  const cfg = { viewAlpha: t >= OUTRO.from ? 0.045 : 1 };

  // title: dots fly in, rings sweep
  if (t < 6) {
    cfg.ringSweep = ramp(t, 0.4, 2.8);
    const start = (st) => 0.9 + st.id * 0.028;
    cfg.dotFrom = (st) => {
      const ang = st.id * 2.39996;
      return { p: [Math.cos(ang) * 2.3, Math.sin(ang) * 1.7 - 0.2], u: ramp(t, start(st), start(st) + 1.5) };
    };
    cfg.dot = (st) => ramp(t, start(st), start(st) + 0.5);
  }

  // every sticker is a dot: one side at a time
  const end = FACE_GLOW.start + FACE_GLOW.faces.length * FACE_GLOW.each;
  const g = window01(t, FACE_GLOW.start - 0.3, end + 0.2, 0.35);
  if (g > 0) {
    const w = faceWeights(t);
    const wt = (st) => lerp(1, w[faceOf(st.normal)] || 0, g);
    cfg.dot = (st) => 0.14 + 0.86 * wt(st);
    cfg.weight3d = wt;
    cfg.faceW = w;
    cfg.faceG = g;
  }
  return cfg;
}

function drawFaceGlow(p, view, cfg) {
  if (!cfg.faceW) return;
  for (const f of FACE_GLOW.faces) {
    const a = cfg.faceW[f] * cfg.faceG;
    if (a <= 0.01) continue;
    const n = FACE_NORMALS[f];
    const c = slotPosition(n, n);
    const [x, y] = toScreen(view, c);
    const col = p.color(COLORS[f]);
    col.setAlpha(46 * a);
    p.noStroke();
    p.fill(col);
    p.circle(x, y, 0.95 * view.s);
    const len = Math.hypot(c[0], c[1]);
    const [lx, ly] = toScreen(view, [c[0] + (c[0] / len) * 0.62, c[1] + (c[1] / len) * 0.62]);
    const hex = COLORS[f];
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * 0.85);
    pill(p, copy.faces[f], lx, ly, a, { size: 24, fg: rgb, lang });
  }
}

function drawTitle(p, t) {
  const a = Math.min(ramp(t, 0.6, 1.6), 1 - ramp(t, 4.6, 5.3));
  if (a <= 0) return;
  p.noStroke();
  p.textAlign(p.CENTER, p.BASELINE);
  textStyle(p, 80, { bold: true, lang });
  p.fill(...INK, 255 * a);
  p.text(copy.title, W / 2, 990 - (1 - a) * 16);
  const b = Math.min(ramp(t, 1.3, 2.3), 1 - ramp(t, 4.6, 5.3));
  textStyle(p, 30, { lang });
  p.fill(...MUTED, 255 * b);
  p.text(copy.subtitle, W / 2, 1042 - (1 - b) * 12);
}

function drawOutro(p, t) {
  const o = Math.min(ramp(t, OUTRO.from + 0.2, OUTRO.from + 1.0), 1 - ramp(t, OUTRO.to - 0.9, OUTRO.to - 0.1));
  if (o <= 0) return;
  p.noStroke();
  p.textAlign(p.CENTER, p.BASELINE);
  textStyle(p, 88, { bold: true, lang });
  p.fill(...INK, 255 * o);
  p.text(copy.outroTitle, W / 2, 440);
  textStyle(p, 32, { lang });
  p.fill(...MUTED, 255 * o);
  p.text(copy.outroBody, W / 2, 510);
  pill(p, '$ npm install && npm run dev', W / 2, 620, o * ramp(t, OUTRO.from + 0.7, OUTRO.from + 1.4), {
    size: 32, mono: true, bold: false, bg: [58, 54, 48], fg: [249, 247, 242],
  });
  textStyle(p, 22, { lang });
  p.fill(...MUTED, 255 * o * ramp(t, OUTRO.from + 1.2, OUTRO.from + 1.9));
  p.text(copy.credits, W / 2, 730);
}

// ---- sketch ----
let bg = null;
let g3 = null;

function makeBackground(p) {
  const b = p.createGraphics(W, H);
  b.pixelDensity(1);
  const ctx = b.drawingContext;
  const grad = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.45, W * 0.7);
  grad.addColorStop(0, '#fbf9f4');
  grad.addColorStop(0.55, '#f9f7f2');
  grad.addColorStop(1, '#efebdf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  return b;
}

function renderAt(p, t) {
  p.image(bg, 0, 0);
  const cfg = sceneSetup(t);

  draw3D(g3, t, { ...camAt(t), weight: cfg.weight3d });
  const a3 = ramp(t, 1.0, 2.6) * cfg.viewAlpha;
  if (a3 > 0) {
    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalAlpha = a3;
    ctx.drawImage(g3.canvas, PANEL_3D.x, PANEL_3D.y, PANEL_3D.w, PANEL_3D.h);
    ctx.restore();
  }

  p.push();
  p.drawingContext.save();
  p.drawingContext.beginPath();
  p.drawingContext.rect(CLIP_2D_X, 0, W - CLIP_2D_X, H);
  p.drawingContext.clip();
  draw2D(p, t, VIEW_2D, {
    alpha: cfg.viewAlpha,
    ringSweep: cfg.ringSweep ?? 1,
    dotAlpha: cfg.dot,
    dotFrom: cfg.dotFrom,
  });
  drawFaceGlow(p, VIEW_2D, cfg);
  p.drawingContext.restore();
  p.pop();

  drawTitle(p, t);
  drawCaption(p, t, copy, lang);
  drawOutro(p, t);

  const fade = Math.max(1 - ramp(t, 0, 0.5), ramp(t, DURATION - 0.6, DURATION));
  if (fade > 0) {
    p.noStroke();
    p.fill(249, 247, 242, 255 * fade);
    p.rect(0, 0, W, H);
  }
}

const RENDER = params.has('render');

new p5((p) => {
  p.setup = async () => {
    const c = p.createCanvas(W, H);
    c.parent('stage');
    p.pixelDensity(1);
    p.noLoop();
    bg = makeBackground(p);
    g3 = await create3D(PANEL_3D.w, PANEL_3D.h);
    const frames = Math.round(DURATION * FPS);
    window.VIDEO = { fps: FPS, frames, duration: DURATION };
    window.renderFrame = (n) => {
      renderAt(p, n / FPS);
      return n;
    };
    if (RENDER) renderAt(p, 0);
    else setupPreview(p, frames);
    window.VIDEO.ready = true;
  };
});

function setupPreview(p, frames) {
  const bar = document.getElementById('scrub');
  const btn = document.getElementById('play');
  const label = document.getElementById('time');
  let playing = !params.has('paused');
  let t = Number(params.get('t') || 0);
  let last = performance.now();
  bar.max = String(frames - 1);
  bar.addEventListener('input', () => {
    t = Number(bar.value) / FPS;
    draw();
  });
  btn.addEventListener('click', () => {
    playing = !playing;
    btn.textContent = playing ? 'Pause' : 'Play';
    last = performance.now();
  });
  btn.textContent = playing ? 'Pause' : 'Play';
  function draw() {
    renderAt(p, t);
    bar.value = String(Math.round(t * FPS));
    label.textContent = `${t.toFixed(2)} s`;
  }
  function tick(now) {
    if (playing) {
      t += (now - last) / 1000;
      if (t >= DURATION) t = 0;
    }
    last = now;
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
