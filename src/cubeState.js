// Logical model of a 3x3x3 cube: 54 stickers, each with an integer position,
// an outward normal and the color (face letter) it had in the solved state.
//
// Coordinates: +x = R, +y = U, +z = F. A move rotates the given layers about
// the +axis by q quarter turns (right-handed, so q = -1 is clockwise when
// looking at the +axis face).

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// normal of each face in the solved cube
export const FACE_NORMALS = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

// Base moves: axis (0=x, 1=y, 2=z), layers and quarter turns about +axis.
const BASE_MOVES = {
  R: { axis: 0, layers: [1], q: -1 },
  L: { axis: 0, layers: [-1], q: 1 },
  M: { axis: 0, layers: [0], q: 1 },
  x: { axis: 0, layers: [-1, 0, 1], q: -1 },
  U: { axis: 1, layers: [1], q: -1 },
  D: { axis: 1, layers: [-1], q: 1 },
  E: { axis: 1, layers: [0], q: 1 },
  y: { axis: 1, layers: [-1, 0, 1], q: -1 },
  F: { axis: 2, layers: [1], q: -1 },
  B: { axis: 2, layers: [-1], q: 1 },
  S: { axis: 2, layers: [0], q: -1 },
  z: { axis: 2, layers: [-1, 0, 1], q: -1 },
};

export const OUTER_FACE_MOVES = ['U', 'D', 'R', 'L', 'F', 'B'];

/** Rotate an integer vector a quarter turn (dir = +1 or -1) about an axis. */
export function rotateVec(v, axis, dir) {
  const [x, y, z] = v;
  if (axis === 0) return dir > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return dir > 0 ? [z, y, -x] : [-z, y, x];
  return dir > 0 ? [-y, x, z] : [y, -x, z];
}

/** Parse one token such as "R", "U'", "F2", "M", "x'". */
export function parseMove(token) {
  const m = /^([RLUDFBMESxyz])(2|'|2')?$/.exec(token.trim());
  if (!m) throw new Error(`Unknown move: ${token}`);
  const base = BASE_MOVES[m[1]];
  const suffix = m[2] || '';
  let q = base.q;
  if (suffix === "'") q = -q;
  else if (suffix.startsWith('2')) q = suffix === "2'" ? -2 * base.q : 2 * base.q;
  return { axis: base.axis, layers: base.layers.slice(), q, name: m[1] + suffix };
}

export function parseAlgorithm(str) {
  return str.split(/\s+/).filter(Boolean).map(parseMove);
}

/** Build a move from an axis/layer/quarter-turn triple (used by drag input). */
export function moveFromTurn(axis, layers, q) {
  const key = layers.slice().sort().join(',');
  for (const [name, base] of Object.entries(BASE_MOVES)) {
    if (base.axis !== axis || base.layers.slice().sort().join(',') !== key) continue;
    let suffix = '';
    if (Math.abs(q) === 2) suffix = '2';
    else if (q !== base.q) suffix = "'";
    return { axis, layers: layers.slice(), q, name: name + suffix };
  }
  throw new Error('No move for turn');
}

export function invertMove(move) {
  let name = move.name;
  if (name.endsWith("'")) name = name.slice(0, -1);
  else if (!name.endsWith('2')) name += "'";
  return { axis: move.axis, layers: move.layers.slice(), q: -move.q, name };
}

export const posKey = (pos, normal) => `${pos.join(',')}|${normal.join(',')}`;

export class CubeState {
  constructor() {
    this.reset();
  }

  reset() {
    this.stickers = [];
    for (const face of FACES) {
      const n = FACE_NORMALS[face];
      const a = n.findIndex((c) => c !== 0);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const pos = [0, 0, 0];
          pos[a] = n[a];
          const others = [0, 1, 2].filter((k) => k !== a);
          pos[others[0]] = i;
          pos[others[1]] = j;
          this.stickers.push({ id: this.stickers.length, pos, normal: n.slice(), color: face });
        }
      }
    }
  }

  clone() {
    const c = Object.create(CubeState.prototype);
    c.stickers = this.stickers.map((s) => ({ ...s, pos: s.pos.slice(), normal: s.normal.slice() }));
    return c;
  }

  static inTurn(sticker, axis, layers) {
    return layers.includes(sticker.pos[axis]);
  }

  applyMove(move) {
    const dir = Math.sign(move.q);
    const turns = Math.abs(move.q);
    for (const s of this.stickers) {
      if (!CubeState.inTurn(s, move.axis, move.layers)) continue;
      for (let t = 0; t < turns; t++) {
        s.pos = rotateVec(s.pos, move.axis, dir);
        s.normal = rotateVec(s.normal, move.axis, dir);
      }
    }
    return this;
  }

  /** Map "x,y,z|nx,ny,nz" -> color letter. */
  colorMap() {
    const map = new Map();
    for (const s of this.stickers) map.set(posKey(s.pos, s.normal), s.color);
    return map;
  }

  isSolved() {
    const faceColor = new Map();
    for (const s of this.stickers) {
      const k = s.normal.join(',');
      if (!faceColor.has(k)) faceColor.set(k, s.color);
      else if (faceColor.get(k) !== s.color) return false;
    }
    return true;
  }

  /**
   * Facelet string in cubejs order (U R F D L B, row-major per face). Letters
   * name the face whose *current* center carries that color, so the string is
   * valid after slice moves and whole-cube rotations too.
   */
  toFaceletString() {
    const colors = this.colorMap();
    const centerLetter = {};
    for (const face of FACES) {
      const n = FACE_NORMALS[face];
      centerLetter[colors.get(posKey(n, n))] = face;
    }
    // For each face: row-major list of [x,y,z] positions.
    const grid = {
      U: (r, c) => [c - 1, 1, r - 1],
      R: (r, c) => [1, 1 - r, 1 - c],
      F: (r, c) => [c - 1, 1 - r, 1],
      D: (r, c) => [c - 1, -1, 1 - r],
      L: (r, c) => [-1, 1 - r, c - 1],
      B: (r, c) => [1 - c, 1 - r, -1],
    };
    let out = '';
    for (const face of FACES) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out += centerLetter[colors.get(posKey(grid[face](r, c), FACE_NORMALS[face]))];
        }
      }
    }
    return out;
  }
}
