// Soundtrack for the demo video, synthesised in plain JS: a soft pad chord
// progression, a bell on every caption beat, a whoosh on scripted turns and a
// chime when the cube is solved.
//
// events: { duration, beats: [t], moves: [{ t, dur }], solvedAt } (seconds)

import { writeFileSync } from 'node:fs';

const SR = 44100;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  [48, 55, 59, 64, 67], // Cmaj7
  [45, 52, 55, 60, 64], // Am7
  [41, 48, 52, 57, 60], // Fmaj7
  [43, 50, 55, 59, 62], // G
];
const CHORD_S = 6;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function addPad(L, R, n, duration) {
  const chords = Math.ceil(duration / CHORD_S);
  for (let c = 0; c < chords; c++) {
    const notes = CHORDS[c % CHORDS.length];
    const t0 = c * CHORD_S;
    const i0 = Math.floor(t0 * SR);
    const len = Math.floor((CHORD_S + 2.8) * SR);
    notes.forEach((m, k) => {
      const f = mtof(m);
      const pan = 0.5 + (k - 2) * 0.12;
      const detune = [0.9965, 1, 1.0035];
      const ph = detune.map((_, j) => (k * 1.3 + j * 2.1) % TAU);
      const amp = 0.05 * (k === 0 ? 1.1 : 0.8);
      for (let i = 0; i < len && i0 + i < n; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 2.2) * (t > CHORD_S + 0.2 ? Math.exp(-(t - CHORD_S - 0.2) * 1.6) : 1);
        let v = 0;
        for (let j = 0; j < 3; j++) {
          const p = ph[j] + TAU * f * detune[j] * t;
          v += Math.sin(p) + 0.12 * Math.sin(2 * p) + 0.05 * Math.sin(3 * p);
        }
        const trem = 1 + 0.12 * Math.sin(TAU * 0.17 * (t0 + t) + k);
        v *= amp * env * trem / 3;
        L[i0 + i] += v * (1 - pan) * 2 * 0.5;
        R[i0 + i] += v * pan * 2 * 0.5;
      }
    });
  }
}

/** Short plucked / bell tone into the given buffers (and the reverb send). */
function addTone(bufs, t0, midi, { amp = 0.1, decay = 0.5, partials = [[1, 1], [2, 0.35], [3, 0.12]], pan = 0.5, attack = 0.004 }) {
  const f = mtof(midi);
  const i0 = Math.floor(t0 * SR);
  const len = Math.floor(decay * 7 * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    let v = 0;
    for (const [h, a] of partials) v += a * Math.sin(TAU * f * h * t) * Math.exp(-t * (h - 1) * 1.5);
    v *= amp * env;
    for (const [buf, gain] of bufs) {
      if (i0 + i >= buf.L.length) break;
      buf.L[i0 + i] += v * (1 - pan) * gain;
      buf.R[i0 + i] += v * pan * gain;
    }
  }
}

function addWhoosh(bufs, t0, dur, amp, rand) {
  const i0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const env = Math.sin(Math.PI * u) ** 2;
    lp += (rand() * 2 - 1 - lp) * 0.06;
    const v = lp * amp * env;
    for (const [buf, gain] of bufs) {
      if (i0 + i >= buf.L.length) break;
      buf.L[i0 + i] += v * gain * (1 - u * 0.6);
      buf.R[i0 + i] += v * gain * (0.4 + u * 0.6);
    }
  }
}

function reverb(src, n) {
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  const combs = [1557, 1617, 1491, 1422, 1277, 1356];
  for (const [ch, off] of [['L', 0], ['R', 23]]) {
    const x = src[ch];
    const y = out[ch];
    for (const d0 of combs) {
      const d = d0 + off;
      const buf = new Float32Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const o = buf[idx];
        lp = o * 0.7 + lp * 0.3;
        buf[idx] = x[i] + lp * 0.84;
        idx = (idx + 1) % d;
        y[i] += o / combs.length;
      }
    }
    for (const d0 of [225, 556]) {
      const d = d0 + off;
      const buf = new Float32Array(d);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const v = -0.5 * y[i] + b;
        buf[idx] = y[i] + 0.5 * b;
        idx = (idx + 1) % d;
        y[i] = v;
      }
    }
  }
  return out;
}

export function renderMusic(ev) {
  const DURATION = ev.duration;
  const n = Math.ceil((DURATION + 0.2) * SR);
  const dry = { L: new Float32Array(n), R: new Float32Array(n) };
  const send = { L: new Float32Array(n), R: new Float32Array(n) };
  const both = (wet) => [[dry, 1], [send, wet]];
  const rand = rng(7);

  addPad(dry.L, dry.R, n, DURATION);
  addPad(send.L, send.R, n, DURATION);

  // bell on every caption beat
  ev.beats.forEach((t, i) => {
    if (t <= 0) return;
    const chord = CHORDS[Math.floor(t / CHORD_S) % CHORDS.length];
    addTone(both(0.9), t, chord[chord.length - 1] + 12, { amp: 0.09, decay: 1.4, partials: [[1, 1], [2.76, 0.3], [5.4, 0.12]], pan: 0.35 + 0.3 * (i % 2) });
  });
  // title shimmer
  [72, 76, 79, 83, 86].forEach((m, i) => addTone(both(1), 1.0 + i * 0.28, m, { amp: 0.05, decay: 1.3, partials: [[1, 1], [2.76, 0.25]], pan: 0.2 + i * 0.15 }));

  for (const m of ev.moves || []) {
    addWhoosh(both(0.5), m.t, m.dur, 0.06, rand);
    addTone(both(0.6), m.t, 67, { amp: 0.06, decay: 0.35, pan: 0.5 });
  }
  // solved arpeggio
  if (ev.solvedAt != null) [72, 76, 79, 84, 88].forEach((m, i) => addTone(both(1), ev.solvedAt + i * 0.09, m, { amp: 0.08, decay: 1.2, partials: [[1, 1], [2, 0.3], [2.76, 0.2]], pan: 0.3 + i * 0.1 }));

  const wet = reverb(send, n);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let peak = 0;
  // gentle low-pass on the mix, fades at both ends
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 1.5) * Math.min(1, Math.max(0, (DURATION - t) / 3.5));
    lpL += (dry.L[i] + 0.55 * wet.L[i] - lpL) * 0.35;
    lpR += (dry.R[i] + 0.55 * wet.R[i] - lpR) * 0.35;
    L[i] = lpL * fade;
    R[i] = lpR * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = 0.8 / (peak || 1);
  for (let i = 0; i < n; i++) {
    L[i] *= g;
    R[i] *= g;
  }
  return { L, R };
}

export function writeMusic(file, events) {
  const { L, R } = renderMusic(events);
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(file, buf);
}
