# Rubik's Cube 2D

[English](README.md) | [简体中文](README.zh-CN.md)

An interactive web recreation of the video [*Mathematical projection of a 3x3 Rubik's Cube*](Mathematical%20projection%20of%20a%203x3%20Rubik's%20Cube.mp4): a 3D cube on the left and its 2D projection (9 intersecting rings carrying 54 colored dots) on the right. Both views are driven by the same cube state, so every move shows up in both at the same time.

![3D cube and its 9-ring 2D projection](Screenshot.png)

## Getting Started

```bash
npm install
npm run dev       # start the Vite dev server
npm run build     # production build
npm run preview   # serve the production build
npm run check     # run the self-tests in Node
```

Dependencies: [three.js](https://threejs.org) for the 3D cube and [cubejs](https://github.com/ldez/cubejs) for the solver. The 2D view is plain Canvas 2D.

## Controls

* **Drag a face** of the 3D cube to turn that layer. The layer follows the pointer live and, on release, snaps to the nearest quarter turn (it commits once you are more than 35% of the way through a turn). Half turns can be dragged too.
* **Hover a face** of the 3D cube to highlight its nine corresponding dots in the 2D projection.
* **Drag the background** to orbit the camera.
* **Keys:** `U D L R F B` (outer faces), `M E S` (middle slices), `X Y Z` (whole-cube rotations). Hold `Shift` for the inverse move; `⌘/Ctrl + Z` undoes.
* **Buttons:** *Scramble* (25 random outer-face moves, never turning the same axis twice in a row), *Solve*, *Undo*, and *Reset*. A move counter and a "Solved" badge sit under the buttons.

## Demo Video

A ~70-second demo video (1920×1080, 60 fps, with a synthesized soundtrack) is generated entirely from code in `video/`: a short p5.js intro that explains the idea in plain words, a guided tour of **the real app** recorded in a headless browser, and a p5.js outro.

```bash
npm run video:render                    # -> video/out/rubiks-cube-projection-demo.mp4 (needs ffmpeg, ~3 min)
node video/render.mjs --lang zh-CN       # -> video/out/rubiks-cube-projection-demo-zh-CN.mp4
npm run video:preview                   # play / scrub the p5.js intro and outro in the browser
node video/render.mjs --only app        # re-record just the app tour (video/out/app.mp4)
node video/render.mjs --stills 7,13     # PNG stills of the p5.js parts
```

* `video/recordApp.mjs` opens the unchanged app with Playwright and plays a scripted tour: hovering faces, dragging a face, orbiting, keys, Undo, Scramble and Solve. Playwright's paused fake clock drives `performance.now` and `requestAnimationFrame`, so every captured frame is exactly 1/60 s apart. The cursor, key badges and captions are injected by the recorder, and `Math.random` is seeded so the scramble is always the same.
* `video/sketch.js` (with `timeline.js`, `draw2d.js`, `draw3d.js`) is a p5.js sketch in which every frame is a pure function of time. It reuses the app's own `CubeState`, ring geometry and `planTurn`.
* `video/music.mjs` synthesizes the soundtrack in plain JS, with a bell on each caption and a chime when the cube is solved.
* `video/render.mjs` renders the p5 clips (in parallel pages) and records the app at the same time, then joins them with crossfades and adds the music using ffmpeg.

## Background: The Video

The video demonstrates a **2D planar representation (or mathematical projection) of a 3x3 Rubik's Cube**.

### What It Shows

1. **Side-by-side equivalence:**
   * **Left:** A standard 3D Rubik's Cube being solved step-by-step.
   * **Right:** A 2D puzzle composed of **9 intersecting circular rings** and **54 colored dots**.
2. **Synchronized moves:**
   * Whenever a face of the 3D Rubik's Cube turns, a corresponding circular track in the 2D diagram rotates.
   * The dots sliding along that circle permute into new positions at the ring intersections, mirroring the exact relocation of the stickers on the 3D cube.
   * At the end (around 00:10), the final turn solves both puzzles simultaneously: all faces of the 3D cube show solid colors, and all 6 clusters in the 2D diagram gather their 9 matching colored dots (Red, Yellow, Blue, Green, Orange, White).

### How the 2D Model Maps to the 3D Cube

* **54 stickers ↔ 54 dots:**
  A standard Rubik's Cube has 6 faces with 9 stickers each ($6 \times 9 = 54$). In the 2D diagram, there are exactly 54 dots arranged into 6 clusters of 9 dots each.
* **Opposite faces:**
  In the solved state, opposite faces of the cube (Yellow–White, Red–Orange, Blue–Green) are mapped antipodally (diametrically opposite each other across the center) in the 2D layout. More precisely, the three faces that meet at the U-F-R corner (Yellow U, Green F, Orange R) form an inner triangle close to the centroid (about 0.57 triangle sides away). Their opposites (White D, Red L, Blue B) sit on the same lines through the centroid, but on the other side and twice as far out (about 1.14 sides away).
* **9 layers ↔ 9 rings:**
  A 3x3 cube has 3 spatial axes ($X, Y, Z$), each containing 3 parallel slice planes (e.g., Left/Middle/Right, Up/Equator/Down, Front/Standing/Back), making 9 slices in total. In the 2D model, there are 3 centers arranged in an equilateral triangle, each with 3 concentric circular tracks ($3 \times 3 = 9$ rings).

### Mathematical Significance

* **Group isomorphism:**
  In abstract algebra and group theory, the moves of a Rubik's Cube form a mathematical permutation group (the *Rubik's Cube group*). This animation visually proves that the permutation group of a 3D cube is **isomorphic** to this 2D circular track system—every valid state and move in 3D has a 1-to-1 counterpart in 2D.
* **Dimensional reduction:**
  While the Rubik's Cube is physically a 3D puzzle, its mathematical complexity does not strictly require 3-dimensional space. It can be flattened into a 2D mechanical puzzle (conceptually similar to puzzles like the *Hungarian Rings*, but expanded to 9 rings) without losing any degrees of freedom or changing its solution algorithms.

## How It Works

### Code Layout

| File | Role |
| --- | --- |
| `src/cubeState.js` | Logical cube: 54 stickers, move notation, applying moves, facelet export |
| `src/projectionGeometry.js` | Geometry of the rings and where each sticker's dot sits |
| `src/projection2d.js` | Canvas renderer for the rings, including how dots travel during a turn |
| `src/cube3d.js` | three.js renderer for the 3D cube, the camera, and pointer picking |
| `src/main.js` | Move queue and animation loop, UI, keyboard and drag input |
| `src/solver.worker.js` | Kociemba solver running in a Web Worker |
| `src/selfcheck.js`, `scripts/selfcheck.mjs` | Consistency tests |

### The Cube Model (`cubeState.js`)

* The cube is stored as **54 stickers**, not 26 cubies. Each sticker has an integer position `pos` in {−1, 0, 1}³, an outward `normal`, and the `color` (face letter) it had when the cube was solved.
* Axes: **+x = R, +y = U, +z = F**. A move is described by `{ axis, layers, q }`: it turns the stickers whose coordinate on `axis` is in `layers` by `q` quarter turns about the positive axis. For example, `R` is `{ axis: x, layers: [1], q: −1 }` and `M` is `{ axis: x, layers: [0], q: +1 }`.
* Applying a move just rotates `pos` and `normal` of the affected stickers by 90° steps. This is exact integer arithmetic, so the state never drifts.
* Standard notation is supported: `R L U D F B`, slices `M E S`, rotations `x y z`, each with `'` (inverse) and `2` (half turn).
* `toFaceletString()` exports the state in the 54-character format cubejs expects (U R F D L B, row-major). Each letter names the face whose *current center* has that color, so the export stays correct after slice moves or whole-cube rotations, which move the centers.

### The 2D Geometry (`projectionGeometry.js`)

All values are in units of the triangle side (the distance between two ring centers) and were measured from the video.

* **Three centers, one per axis:** A (top) carries the y slices (U / E / D), B (bottom-left) the z slices (F / S / B), and C (bottom-right) the x slices (R / M / L).
* **Three concentric rings per center, one per layer:** the ring radius depends on the layer coordinate k as `r(k) = 1.019 − 0.218·k`. The positive-side layer gets the smallest ring (0.801), the middle slice 1.019, and the negative-side layer 1.237.
* **Where a dot sits:** a sticker whose normal points along axis *a* belongs to exactly one layer on each of the other two axes *b* and *c*. Its dot is placed where ring `r(pos[b])` around center *b* crosses ring `r(pos[c])` around center *c*. Two circles cross at two points; the dot takes the one on center *a*'s side of the line *bc* if the normal is positive (U, R, F) and the far side otherwise (D, L, B). This one rule produces the inner and outer clusters described above.
* As a result, **every ring carries exactly 12 dots**, the same 12 stickers that go around the side of that slice on the real cube. Each face's own 9 stickers form a cluster around their center dot, at the crossing of the two middle rings.

### How a Turn Looks in 2D (`projection2d.js`)

A turn of one layer moves two kinds of dots:

1. **The 12 side stickers of the layer** slide along their ring. A quarter turn moves each of them 3 slots out of 12. The slots on a ring are not evenly spaced, so each dot moves at constant radius but covers its own angle.
2. **The 9 stickers on the turning face** (only for outer-face moves) swirl around the face's center dot: the center stays still and the 8 others move 2 slots out of 8 in polar coordinates.

Because the slots are uneven, the shortest path would send some dots of the same group the "wrong" way round. `planTurn` therefore makes every dot in a group travel in the same direction by the same number of slots, so the ring appears to rotate as one rigid track. Half turns are planned as two quarter-turn steps.

Visual extras: the rings being turned are drawn darker and fade back afterwards, moving dots leave short fading color trails, and moving dots are drawn on top of the others.

### The 3D Cube (`cube3d.js`)

* 26 rounded cubies with rounded stickers. The default camera looks at the U-F-R corner from slightly above, as in the video.
* During a turn, the affected cubies are temporarily attached to a pivot group and rotated. When the move is committed, every cubie goes back to its home position and only the sticker colors are updated from the state, so the 3D view can never drift from the logical cube.
* Picking casts a ray against the cube's bounding box rather than the individual meshes, so clicks in the gaps between cubies still grab a face.
* Sticker colors are shared with the 2D view: Yellow U, White D, Green F, Blue B, Orange R, Red L.

### Animation and Synchronization (`main.js`)

* All moves (keys, scramble, solve, undo) go into **one queue**. Each frame, one animation parameter *f* (from 0 to 1 or 2 quarter turns, with cubic easing) is passed to both the 3D pivot and the 2D dot planner, so both views are always at the exact same stage of the turn.
* Durations: 350 ms for a normal move, 140 ms per scramble move, and 240 ms per solve move. Half turns take 1.5 times as long.
* The logical state is only changed when the animation finishes. A drag that is released short of the snap threshold springs back and nothing is recorded.

### Solver (`solver.worker.js`)

* The *Solve* button uses **Kociemba's two-phase algorithm** from cubejs. It typically finds a solution of about 20 moves or fewer, not the beginner-method solve shown in the video.
* Building the solver's lookup tables takes a few seconds, so it runs in a Web Worker. The button reads "Preparing solver…" until the worker reports that it is ready.
* If you press *Solve* while moves are still animating, it waits until the queue is empty and solves from that state. The solution is then played back in both views.

### Verification (`selfcheck.js`, `scripts/selfcheck.mjs`)

These run automatically in the browser console in dev mode, and via `npm run check`:

* The solved cube exports the solved facelet string and is recognized as solved.
* All 54 dots have distinct positions.
* Every move (`U D R L F B M E S x y z`) applied 4 times, or followed by its inverse, returns to the identity.
* After each step of a long mixed sequence, every ring still holds exactly 12 dots, and every planned 2D turn keeps each group's dots in cyclic order.
* Solver round trip (Node only): scrambles that include slice moves and rotations are exported, solved by cubejs, and the solution really solves the cube.
