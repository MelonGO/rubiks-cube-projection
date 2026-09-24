// Renders the demo video to MP4:
//   intro (p5.js)  ->  guided tour of the real app (Playwright)  ->  outro (p5.js)
// joined with short crossfades, plus a soundtrack synthesised in JS.
//
//   node video/render.mjs                  full video -> video/out/rubiks-cube-projection-demo.mp4
//   node video/render.mjs --only p5        p5 clips only (intro.mp4, outro.mp4)
//   node video/render.mjs --only app       app recording only (app.mp4)
//   node video/render.mjs --stills 3,9,13  PNG stills of the p5 sketch
//   options: --workers N (p5 pages in parallel, default 4)

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeMusic } from './music.mjs';
import { recordApp } from './recordApp.mjs';
import { BEATS, FPS, H, INTRO, MOVES, OUTRO, W } from './timeline.js';
import { videoText, ZH_CN } from './locale.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = join(here, 'out');
const XFADE = 0.5;

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const workers = Number(arg('workers', 4));
const stills = arg('stills', null);
const only = arg('only', null);
const lang = arg('lang', 'en');
videoText(lang);
const suffix = lang === ZH_CN ? '-zh-CN' : '';
const out = join(outDir, `rubiks-cube-projection-demo${suffix}.mp4`);

function run(cmd, cmdArgs) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} exited with ${code}`))));
  });
}

async function openSketch(browser, url) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.VIDEO && window.VIDEO.ready, null, { timeout: 30000 });
  return page;
}

const CLIP = { x: 0, y: 0, width: W, height: H };
// JPEG at quality 98 is ~15x faster to grab than PNG and visually lossless before x264
const captureFrame = (page) => page.screenshot({ type: 'jpeg', quality: 98, clip: CLIP });

// Prefer full Chromium on the GPU; fall back to software WebGL (SwiftShader).
async function launch() {
  try {
    return await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  } catch {
    return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  }
}

async function renderChunk(browser, url, f0, f1, file, onFrame) {
  const page = await openSketch(browser, url);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    file,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((ok, fail) => ff.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg ${c}`)))));
  for (let n = f0; n < f1; n++) {
    await page.evaluate((k) => window.renderFrame(k), n);
    const img = await captureFrame(page);
    if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once('drain', r));
    onFrame();
  }
  ff.stdin.end();
  await done;
  await page.close();
}

/** Render sketch time [from, to) to `file`, split across parallel pages. */
async function renderSketchClip(browser, url, { from, to }, file, n, onFrame) {
  const f0 = Math.round(from * FPS);
  const total = Math.round(to * FPS) - f0;
  const tmp = join(outDir, `tmp-${process.pid}-${from}`);
  mkdirSync(tmp, { recursive: true });
  const chunks = Array.from({ length: n }, (_, i) => ({
    a: f0 + Math.round((total * i) / n),
    b: f0 + Math.round((total * (i + 1)) / n),
    file: join(tmp, `part-${i}.mp4`),
  }));
  await Promise.all(chunks.map((c) => renderChunk(browser, url, c.a, c.b, c.file, onFrame)));
  const list = join(tmp, 'list.txt');
  writeFileSync(list, chunks.map((c) => `file '${c.file}'`).join('\n'));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', file]);
  rmSync(tmp, { recursive: true, force: true });
}

function progress(label, total) {
  let k = 0;
  const t0 = Date.now();
  return () => {
    k++;
    if (k % 60 === 0 || k === total) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${label}: ${k}${total ? `/${total}` : ''} frames, ${el.toFixed(0)} s`);
    }
  };
}

const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const base = server.resolvedUrls.local[0];
const sketchUrl = `${base}video/?render&lang=${encodeURIComponent(lang)}`;
const browser = await launch();
mkdirSync(outDir, { recursive: true });

try {
  if (stills) {
    const page = await openSketch(browser, sketchUrl);
    for (const s of stills.split(',').map(Number)) {
      await page.evaluate((k) => window.renderFrame(k), Math.round(s * FPS));
      const file = join(outDir, `still-${String(s).replace('.', '_')}.png`);
      writeFileSync(file, await page.screenshot({ type: 'png', clip: CLIP }));
      console.log(file);
    }
  } else {
    const intro = join(outDir, `intro${suffix}.mp4`);
    const outro = join(outDir, `outro${suffix}.mp4`);
    const app = join(outDir, `app${suffix}.mp4`);
    const jobs = [];
    if (only !== 'app') {
      const nIntro = Math.max(1, workers - 1);
      jobs.push(renderSketchClip(browser, sketchUrl, INTRO, intro, nIntro, progress('intro', (INTRO.to - INTRO.from) * FPS)));
      jobs.push(renderSketchClip(browser, sketchUrl, OUTRO, outro, 1, progress('outro', (OUTRO.to - OUTRO.from) * FPS)));
    }
    let tour = null;
    if (only !== 'p5') jobs.push(recordApp({ browser, baseUrl: base, file: app, lang, onFrame: progress('app') }).then((r) => (tour = r)));
    await Promise.all(jobs);

    if (!only) {
      const introDur = INTRO.to - INTRO.from;
      const o1 = introDur - XFADE;
      const o2 = introDur + tour.duration - 2 * XFADE;
      const total = o2 + (OUTRO.to - OUTRO.from);
      const music = join(outDir, 'music.wav');
      writeMusic(music, {
        duration: total,
        beats: [...BEATS, ...tour.beats.map((b) => b + o1), o2 + 0.3],
        moves: MOVES.map((m) => ({ t: m.t, dur: m.dur })),
        solvedAt: tour.solvedAt + o1,
      });
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', intro, '-i', app, '-i', outro, '-i', music,
        '-filter_complex',
        `[0:v][1:v]xfade=transition=fade:duration=${XFADE}:offset=${o1.toFixed(3)}[v1];` +
          `[v1][2:v]xfade=transition=fade:duration=${XFADE}:offset=${o2.toFixed(3)}[v]`,
        '-map', '[v]', '-map', '3:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
        out,
      ]);
      console.log(`${out}  (${total.toFixed(1)} s)`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
