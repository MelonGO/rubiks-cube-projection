// p5 WEBGL renderer for the 3D cube, driven by the same time-indexed state as
// the 2D view. Mirrors src/cube3d.js: off-white rounded cubies, rounded
// stickers, camera looking at the U-F-R corner.

import p5 from 'p5';
import { FACE_NORMALS, posKey } from '../src/cubeState.js';
import { COLORS } from '../src/projection2d.js';
import { cubeAt } from './cubeAtTime.js';

const U = 100; // pixels per cubie in model space
const CUBIE = 0.97;
const STICKER = 0.8;
const STICKER_RADIUS = 0.13;
const FOV = (12 * Math.PI) / 180;
const BODY = [243, 242, 238];
const DIM_TO = [214, 210, 202];
const NORMALS = Object.values(FACE_NORMALS);

const HOMES = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) if (x || y || z) HOMES.push([x, y, z]);
  }
}

let stickerGeom = null;

function roundedSquare(g) {
  const h = (STICKER * U) / 2;
  const r = STICKER_RADIUS * U;
  g.beginShape();
  const corners = [
    [h - r, h - r, 0],
    [-h + r, h - r, Math.PI / 2],
    [-h + r, -h + r, Math.PI],
    [h - r, -h + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      g.vertex(cx + r * Math.cos(a), cy + r * Math.sin(a), 0);
    }
  }
  g.endShape(g.CLOSE);
}

// orient a +z-facing sticker so it faces normal n
function faceTowards(g, n) {
  if (n[0]) g.rotateY((n[0] * Math.PI) / 2);
  else if (n[1]) g.rotateX((-n[1] * Math.PI) / 2);
  else if (n[2] < 0) g.rotateY(Math.PI);
}

/** A separate WEBGL p5 instance (hidden); its canvas is composited by the main sketch. */
export function create3D(w, h) {
  return new Promise((done) => {
    const holder = document.createElement('div');
    holder.style.display = 'none';
    document.body.appendChild(holder);
    new p5((g) => {
      g.setup = () => {
        g.createCanvas(w, h, g.WEBGL);
        g.pixelDensity(1);
        g.noLoop();
        stickerGeom = g.buildGeometry(() => roundedSquare(g));
        done(g);
      };
    }, holder);
  });
}

/**
 * opts:
 *  az, el, zoom      camera (radians; zoom 1 frames the whole cube)
 *  weight(sticker)   1 = full colour, 0 = faded towards the body colour
 *  lift(sticker)     0..1, pops the sticker outwards
 */
export function draw3D(g, t, opts = {}) {
  const { az = Math.PI / 4, el = 0.3, zoom = 1 } = opts;
  const { state, turn } = cubeAt(t);
  const w = g.width;
  const h = g.height;
  g.clear();
  g.push();

  const aspect = w / h;
  const halfMin = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect));
  const d = ((2.9 * U) / Math.sin(halfMin)) / zoom;
  g.perspective(FOV, aspect, d - 6 * U, d + 6 * U);
  // cube space is right-handed with +y up; p5's world has +y down, so we
  // flip y for both the camera and the model
  const ce = Math.cos(el);
  g.camera(d * ce * Math.sin(az), -d * Math.sin(el), d * ce * Math.cos(az), 0, 0, 0, 0, 1, 0);

  // lights in p5 world space (+y down): key from above-left-front, soft fill from the right
  g.noStroke();
  g.ambientLight(150);
  g.directionalLight(95, 95, 92, 0.3, 0.85, -0.45);
  g.directionalLight(55, 55, 55, -0.8, 0.2, -0.3);
  g.scale(1, -1, 1);

  const byKey = new Map(state.stickers.map((s) => [posKey(s.pos, s.normal), s]));
  const angle = turn ? turn.dir * turn.f * (Math.PI / 2) : 0;

  for (const home of HOMES) {
    g.push();
    if (turn && turn.layers.includes(home[turn.axis])) {
      if (turn.axis === 0) g.rotateX(angle);
      else if (turn.axis === 1) g.rotateY(angle);
      else g.rotateZ(angle);
    }
    g.translate(home[0] * U, home[1] * U, home[2] * U);
    g.fill(...BODY);
    g.specularMaterial(40);
    g.shininess(20);
    g.box(CUBIE * U);
    for (const n of NORMALS) {
      const a = n.findIndex((v) => v !== 0);
      if (home[a] !== n[a]) continue;
      const st = byKey.get(posKey(home, n));
      const wgt = opts.weight ? opts.weight(st) : 1;
      const lift = opts.lift ? opts.lift(st) : 0;
      const c = g.color(COLORS[st.color]);
      const mix = 1 - wgt;
      const rgb = [g.red(c), g.green(c), g.blue(c)].map((v, i) => v + (DIM_TO[i] - v) * mix * 0.8);
      g.push();
      const off = CUBIE / 2 + 0.006 + lift * 0.35;
      g.translate(n[0] * off * U, n[1] * off * U, n[2] * off * U);
      faceTowards(g, n);
      g.fill(...rgb);
      g.emissiveMaterial(...rgb.map((v) => v * 0.16));
      g.specularMaterial(30);
      g.model(stickerGeom);
      g.pop();
      g.emissiveMaterial(0);
    }
    g.pop();
  }
  g.pop();
}
