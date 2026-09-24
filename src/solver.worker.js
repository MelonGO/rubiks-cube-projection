// Kociemba two-phase solver (cubejs), kept off the main thread because
// building its tables takes a few seconds.
//
// cubejs is CommonJS whose solve.js extends `this.Cube`; bundling it as ESM
// leaves `this` undefined, so evaluate the sources with an explicit scope.
import cubeSrc from 'cubejs/lib/cube.js?raw';
import solveSrc from 'cubejs/lib/solve.js?raw';

const scope = {};
new Function(cubeSrc).call(scope);
new Function(solveSrc).call(scope);
const Cube = scope.Cube;

Cube.initSolver();
self.postMessage({ type: 'ready' });

self.onmessage = (e) => {
  const { id, facelets } = e.data;
  try {
    const solution = Cube.fromString(facelets).solve();
    self.postMessage({ type: 'solution', id, solution });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err && err.message ? err.message : err) });
  }
};
