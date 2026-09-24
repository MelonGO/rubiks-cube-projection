// Script of the p5 parts of the demo video (the middle part is a recording of
// the real app, see recordApp.mjs). Pure data, shared by the sketch and the
// renderer. The sketch runs on one time axis; INTRO and OUTRO are rendered as
// separate clips and joined with the app recording.

import { parseAlgorithm } from '../src/cubeState.js';

export const W = 1920;
export const H = 1080;
export const FPS = 60;

export const INTRO = { from: 0, to: 17 };
export const OUTRO = { from: 17, to: 23 };
export const DURATION = OUTRO.to;

// one slow turn in the concept scene
const TURN_AT = 12.0;
const TURN_DUR = 2.4;
export const MOVES = [{ index: 0, name: 'R', move: parseAlgorithm('R')[0], t: TURN_AT, dur: TURN_DUR, group: 'demo' }];

// faces that glow one after another in "every sticker is a dot"
export const FACE_GLOW = { faces: ['F', 'U', 'R'], start: 5.8, each: 1.8 };

export const CAPTIONS = [
  { start: 5.2, end: 11.2 },
  { start: 11.2, end: 16.9 },
];

/** Beats (caption / scene starts) for the soundtrack, in sketch time. */
export const BEATS = [5.2, 11.2, TURN_AT];
