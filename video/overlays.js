// Text overlays for the p5 parts of the video: captions and label pills.

import { CAPTIONS, W } from './timeline.js';
import { ZH_CN } from './locale.js';
import { ramp, window01 } from './cubeAtTime.js';

export const FONT = 'Helvetica Neue';
export const MONO = 'Menlo';
const INK = [58, 54, 48];
const MUTED = [128, 123, 115];

export function textStyle(p, size, { bold = false, mono = false, spacing = 0, lang = 'en' } = {}) {
  p.textFont(mono ? MONO : lang === ZH_CN ? 'PingFang SC' : FONT);
  p.textSize(size);
  p.textStyle(bold ? p.BOLD : p.NORMAL);
  p.drawingContext.letterSpacing = `${spacing}px`;
}

export function drawCaption(p, t, copy, lang) {
  for (const [i, c] of CAPTIONS.entries()) {
    const a = window01(t, c.start, c.end, 0.45);
    if (a <= 0) continue;
    const dy = (1 - ramp(t, c.start, c.start + 0.6)) * 18;
    p.noStroke();
    p.textAlign(p.CENTER, p.BASELINE);
    textStyle(p, 40, { bold: true, lang });
    p.fill(...INK, 255 * a);
    p.text(copy.captions[i].title, W / 2, 962 + dy);
    textStyle(p, 25, { lang });
    p.fill(...MUTED, 255 * a);
    p.text(copy.captions[i].body, W / 2, 1008 + dy);
  }
}

/** Small rounded label with a background pill. */
export function pill(p, text, x, y, a, { size = 22, fg = INK, bg = [255, 253, 248], align = 'center', bold = true, mono = false, lang = 'en' } = {}) {
  if (a <= 0) return;
  textStyle(p, size, { bold, mono, lang });
  const w = p.textWidth(text) + size * 1.1;
  const h = size * 1.7;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  p.stroke(...INK, 40 * a);
  p.strokeWeight(1.2);
  p.fill(...bg, 235 * a);
  p.rect(x0, y - h / 2, w, h, h / 2);
  p.noStroke();
  p.fill(...fg, 255 * a);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(text, x0 + w / 2, y + size * 0.05);
}
