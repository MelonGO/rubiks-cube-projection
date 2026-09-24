// Guided tour of the real app (index.html + src/, untouched), recorded frame
// by frame. Playwright's fake clock drives performance.now and
// requestAnimationFrame, so every frame is exactly 1/60 s apart. A cursor,
// key badges and captions are injected into the page by this recorder only.

import { spawn } from 'node:child_process';
import { videoText, ZH_CN } from './locale.js';

const FPS = 60;
const VIEW = { width: 1280, height: 720 }; // x1.5 device scale -> 1920x1080 frames
const SCALE = 1.5;

// Injected before the app loads: seeded Math.random (reproducible scramble)
// and the overlay (cursor, key badge, caption), animated from the faked clock.
const OVERLAY = () => {
  let seed = 20260925;
  Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  window.addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent = `
      .rec-layer { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: system-ui, -apple-system, 'Helvetica Neue', sans-serif; }
      .rec-caption { position: absolute; left: 50%; top: 22px; transform: translateX(-50%); padding: 10px 24px; border-radius: 999px;
        background: rgba(58, 54, 48, 0.9); color: #f9f7f2; font-size: 21px; font-weight: 600; white-space: nowrap; box-shadow: 0 6px 24px rgba(0,0,0,.12); }
      .rec-caption small { display: block; font-size: 14px; font-weight: 400; opacity: .8; text-align: center; margin-top: 2px; }
      .rec-key { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%); min-width: 64px; padding: 10px 18px; border-radius: 14px;
        background: #fff; border: 2px solid #3a3630; border-bottom-width: 6px; color: #3a3630; font-size: 36px; font-weight: 700; text-align: center; }
      .rec-cursor { position: absolute; width: 26px; height: 26px; margin: -3px 0 0 -3px; }
      .rec-ring { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid rgba(58,54,48,.55); }
    `;
    document.head.appendChild(css);
    const layer = document.createElement('div');
    layer.className = 'rec-layer';
    layer.innerHTML = `
      <div class="rec-caption"></div>
      <div class="rec-key"></div>
      <div class="rec-ring"></div>
      <svg class="rec-cursor" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.5 15 L18.5 15 Z" fill="#fff" stroke="#3a3630" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(layer);
    const $ = (s) => layer.querySelector(s);
    const st = { x: -100, y: -100, down: false, downAt: -1e9, cap: null, capAt: -1e9, prevCap: null, key: '', keyAt: -1e9 };
    window.addEventListener('mousemove', (e) => { st.x = e.clientX; st.y = e.clientY; }, true);
    window.addEventListener('mousedown', () => { st.down = true; st.downAt = performance.now(); }, true);
    window.addEventListener('mouseup', () => { st.down = false; st.downAt = performance.now(); }, true);
    window.addEventListener('keydown', (e) => {
      const k = e.code.replace('Key', '');
      st.key = e.shiftKey ? `${k}′` : k;
      st.keyAt = performance.now();
    }, true);
    window.__rec = {
      caption(title, sub) { st.prevCap = st.cap; st.cap = title ? { title, sub } : null; st.capAt = performance.now(); },
    };
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const tick = () => {
      const now = performance.now();
      const c = $('.rec-cursor');
      c.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.down ? 0.88 : 1})`;
      const ring = $('.rec-ring');
      const rt = (now - st.downAt) / 350;
      ring.style.left = `${st.x}px`;
      ring.style.top = `${st.y}px`;
      ring.style.opacity = st.down ? 0.9 : String(clamp(1 - rt) * 0.9);
      ring.style.transform = `scale(${st.down ? 0.8 : 0.8 + 0.6 * clamp(rt)})`;
      const cap = $('.rec-caption');
      const u = clamp((now - st.capAt) / 400);
      const shown = u < 0.5 ? st.prevCap : st.cap;
      const a = u < 0.5 ? 1 - u * 2 : (u - 0.5) * 2;
      if (shown) cap.innerHTML = shown.title + (shown.sub ? `<small>${shown.sub}</small>` : '');
      cap.style.opacity = shown ? String(a) : '0';
      cap.style.marginTop = `${(1 - a) * -8}px`;
      const key = $('.rec-key');
      const kt = (now - st.keyAt) / 900;
      key.textContent = st.key;
      key.style.opacity = String(kt < 0.15 ? kt / 0.15 : clamp((1 - kt) / 0.35));
      key.style.transform = `translateX(-50%) scale(${kt < 0.15 ? 0.85 + kt : 1})`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Records the tour to `file` (H.264, no audio). Returns { duration, beats, solvedAt }
 * in seconds from the start of the clip, for the soundtrack.
 */
export async function recordApp({ browser, baseUrl, file, lang = 'en', onFrame = () => {} }) {
  const copy = videoText(lang);
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  page.on('pageerror', (e) => console.error('app error:', e.message));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.addInitScript(OVERLAY);
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.__app && window.__rec);
  if (lang === ZH_CN) {
    await page.evaluate((labels) => {
      document.documentElement.lang = 'zh-CN';
      document.querySelector('#scramble').textContent = labels.scramble;
      document.querySelector('#undo').textContent = labels.undo;
      document.querySelector('#reset').textContent = labels.reset;
      document.querySelector('#solved').textContent = labels.solved;
      document.querySelector('.hint').innerHTML = labels.hint;
      const solve = document.querySelector('#solve');
      const moves = document.querySelector('#moves');
      const translate = () => {
        const solveLabels = { 'Preparing solver…': labels.preparing, 'Solving…': labels.solving, Solve: labels.solve };
        if (solveLabels[solve.textContent]) solve.textContent = solveLabels[solve.textContent];
        const n = /^\d+/.exec(moves.textContent)?.[0];
        if (n && !moves.textContent.endsWith(' 步')) moves.textContent = `${n} 步`;
      };
      translate();
      new MutationObserver(translate).observe(document.querySelector('.controls'), { subtree: true, childList: true, characterData: true });
    }, copy.app);
  }
  // installed clocks still follow real time; pause so only frame() moves it
  // (screenshots take real time and would otherwise speed the app up)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200);

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    file,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const encoded = new Promise((ok, fail) => ff.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg ${c}`)))));

  let n = 0;
  const beats = [];
  let solvedAt = null;
  const cursor = { x: VIEW.width * 0.52, y: VIEW.height * 0.9 };
  const now = () => n / FPS;

  async function frame() {
    await page.clock.runFor(Math.round(((n + 1) * 1000) / FPS) - Math.round((n * 1000) / FPS));
    const img = await page.screenshot({ type: 'jpeg', quality: 98 });
    if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once('drain', r));
    n++;
    onFrame();
  }
  const wait = async (s) => {
    for (let i = Math.round(s * FPS); i > 0; i--) await frame();
  };
  async function moveTo(x, y, s = 0.8) {
    const x0 = cursor.x;
    const y0 = cursor.y;
    const k = Math.max(1, Math.round(s * FPS));
    for (let i = 1; i <= k; i++) {
      const u = ease(i / k);
      cursor.x = x0 + (x - x0) * u;
      cursor.y = y0 + (y - y0) * u;
      await page.mouse.move(cursor.x, cursor.y);
      await frame();
    }
  }
  async function drag(x0, y0, x1, y1, s = 1.0) {
    await moveTo(x0, y0, 0.7);
    await page.mouse.down();
    await wait(0.15);
    await moveTo(x1, y1, s);
    await wait(0.1);
    await page.mouse.up();
  }
  async function click(selector) {
    const b = await page.locator(selector).boundingBox();
    await moveTo(b.x + b.width / 2, b.y + b.height / 2, 0.7);
    await wait(0.15);
    await page.mouse.down();
    await wait(0.1);
    await page.mouse.up();
  }
  async function key(k, hold = 0.9) {
    await page.keyboard.press(k);
    await wait(hold);
  }
  async function caption(title, sub = '') {
    beats.push(now());
    await page.evaluate(([t, s]) => window.__rec.caption(t, s), [title, sub]);
  }
  /** Screen position (CSS px) of a point on the cube, in cube units (face at +-1.5). */
  const project = (p) => page.evaluate(([x, y, z]) => {
    const { cube } = window.__app;
    const v = cube.camera.position.clone().set(x, y, z).project(cube.camera);
    const r = cube.renderer.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  }, p);
  // idle = no layer turning for a few frames in a row
  async function waitIdle(extra = 0.6) {
    let calm = 0;
    while (calm < 4) {
      await frame();
      calm = (await page.evaluate(() => window.__app.cube.turnKey === null)) ? calm + 1 : 0;
    }
    await wait(extra);
  }

  // ---- the tour ----
  await wait(0.6);
  await caption(...copy.tour[0]);
  await wait(3.4);

  await caption(...copy.tour[1]);
  for (const p of [[0, 0, 1.5], [0, 1.5, 0], [1.5, 0, 0]]) {
    const [x, y] = await project(p);
    await moveTo(x, y, 0.9);
    await wait(1.3);
  }

  await caption(...copy.tour[2]);
  {
    const [x0, y0] = await project([1, -0.2, 1.5]);
    const [x1, y1] = await project([1, 1.8, 1.5]);
    await drag(x0, y0, x1, y1, 1.2);
    await waitIdle(0.8);
    const [x2, y2] = await project([-0.2, 1.5, 1]);
    const [x3, y3] = await project([1.6, 1.5, 1]);
    await drag(x2, y2, x3, y3, 1.1);
    await waitIdle(0.8);
  }

  await caption(...copy.tour[3]);
  {
    const r = await page.evaluate(() => {
      const b = window.__app.cube.renderer.domElement.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    });
    const x = r.x + r.w * 0.2;
    const y = r.y + r.h * 0.86;
    // orbit is linear in the drag distance, so the same drag reversed (from
    // the same empty spot) brings the camera back to the default view
    await drag(x, y, x + 120, y - 30, 1.3);
    await wait(0.5);
    await drag(x, y, x - 120, y + 30, 1.2);
    await wait(0.6);
  }

  await caption(...copy.tour[4]);
  await moveTo(VIEW.width * 0.5, VIEW.height * 0.62, 0.6);
  await key('KeyU', 1.0);
  await key('KeyR', 1.0);
  await key('Shift+KeyF', 1.2);
  await waitIdle(0.4);

  await caption(...copy.tour[5]);
  await click('#undo');
  await wait(0.7);
  await page.mouse.down();
  await wait(0.1);
  await page.mouse.up();
  await waitIdle(0.8);

  await caption(...copy.tour[6]);
  await click('#scramble');
  const scrambleAt = now();
  await waitIdle(0.8);
  if (process.env.REC_DEBUG) console.log('scramble', scrambleAt.toFixed(2), '->', now().toFixed(2));

  // the solver builds its tables in a worker, in real time
  while (await page.evaluate(() => document.getElementById('solve').disabled)) await sleep(100);
  await caption(...copy.tour[7]);
  await click('#solve');
  for (let i = 0; i < 100 && (await page.evaluate((label) => document.getElementById('solve').textContent === label, copy.app.solving)); i++) {
    await sleep(50);
  }
  await wait(0.2);
  await moveTo(VIEW.width * 0.5, VIEW.height * 0.62, 0.8);
  while (!(await page.evaluate(() => document.getElementById('solved').classList.contains('show')))) await frame();
  solvedAt = now();
  if (process.env.REC_DEBUG) console.log('solved at', solvedAt.toFixed(2));
  await caption(...copy.tour[8]);
  await wait(3.2);

  ff.stdin.end();
  await encoded;
  await page.close();
  return { duration: now(), beats, solvedAt };
}
