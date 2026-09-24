// Geometry of the 2D "9 rings / 54 dots" projection, in units of the triangle
// side s (distance between two ring centers). Measured from the video.
//
// Center A (top) carries the y-slices, B (bottom-left) the z-slices and
// C (bottom-right) the x-slices. Each has 3 concentric rings, one per layer.

const SQ3 = Math.sqrt(3);

// centers indexed by cube axis (0 = x -> C, 1 = y -> A, 2 = z -> B),
// relative to the triangle's centroid, y pointing down (canvas convention)
export const CENTERS = [
  [0.5, SQ3 / 6], // C  (x axis)
  [0, -SQ3 / 3], // A  (y axis)
  [-0.5, SQ3 / 6], // B  (z axis)
];

export const DOT_RADIUS = 0.1;

/** Ring radius for layer coordinate k in {+1, 0, -1}. */
export const ringRadius = (k) => 1.019 - 0.218 * k;

/** Side of the directed line p->q that point x lies on (sign of cross product). */
function side(p, q, x) {
  return Math.sign((q[0] - p[0]) * (x[1] - p[1]) - (q[1] - p[1]) * (x[0] - p[0]));
}

function circleIntersections(c0, r0, c1, r1) {
  const dx = c1[0] - c0[0];
  const dy = c1[1] - c0[1];
  const d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0[0] + (a * dx) / d;
  const my = c0[1] + (a * dy) / d;
  return [
    [mx + (h * -dy) / d, my + (h * dx) / d],
    [mx - (h * -dy) / d, my - (h * dx) / d],
  ];
}

const slotCache = new Map();

/**
 * Position of the dot for a sticker at cubie position `pos` whose outward
 * normal is `normal`. It lies on the ring of each of the two other axes (radius
 * by the sticker's coordinate on that axis), at the intersection on center a's
 * side of line (b, c) when the normal points along +a, else on the far side.
 */
export function slotPosition(pos, normal) {
  const key = `${pos}|${normal}`;
  const cached = slotCache.get(key);
  if (cached) return cached;
  const a = normal.findIndex((v) => v !== 0);
  const sigma = normal[a];
  const [b, c] = [0, 1, 2].filter((k) => k !== a);
  const pts = circleIntersections(CENTERS[b], ringRadius(pos[b]), CENTERS[c], ringRadius(pos[c]));
  const want = side(CENTERS[b], CENTERS[c], CENTERS[a]) * sigma;
  const p = side(CENTERS[b], CENTERS[c], pts[0]) === want ? pts[0] : pts[1];
  slotCache.set(key, p);
  return p;
}
