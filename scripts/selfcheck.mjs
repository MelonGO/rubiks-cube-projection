import { runSelfChecks } from '../src/selfcheck.js';
import { CubeState, parseAlgorithm } from '../src/cubeState.js';
import Cube from 'cubejs';

const fails = runSelfChecks();

// solver round trip, including slice moves and rotations
Cube.initSolver();
for (const alg of ["R U F' L2 D B'", "M E S x", "y R2 z' U M' F"]) {
  const s = new CubeState();
  parseAlgorithm(alg).forEach((m) => s.applyMove(m));
  const sol = Cube.fromString(s.toFaceletString()).solve();
  parseAlgorithm(sol).forEach((m) => s.applyMove(m));
  if (!s.isSolved()) fails.push(`solver failed for ${alg}: ${sol}`);
}

if (fails.length) {
  console.error('FAIL\n' + fails.join('\n'));
  process.exit(1);
}
console.log('all self-checks passed');
