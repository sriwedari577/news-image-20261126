// News broadsheet for Thursday 26 November 2026.
// Node 22, standard library only. Draws a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR
// (or /output/entry.png when unset). Deterministic: no clock, no randomness.
// Every glyph below is a stroke design made for this page on a 6-by-10 grid.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

function rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
const PAPER = rgb("#f7f1e3");
const INK = rgb("#141210");
const RED = rgb("#b3202c");
const BLUE = rgb("#1d4e89");
const TEAL = rgb("#0f6b5c");
const GOLD = rgb("#c4901a");
const GREY = rgb("#6b655a");
const LIGHT = rgb("#e8dfc9");
const MIDGREY = rgb("#9a937f");

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; i += 3; }
  }
}
function hRule(x, y, w, h, c) { fillRect(x, y, w, h, c); }
function disc(cx, cy, r, c) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) px(x, y, c);
    }
  }
}
function ring(cx, cy, r, t, c) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = -t / 2; k <= t / 2; k += 0.7) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}
function seg(x1, y1, x2, y2, w, c) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(len / 0.3);
  const half = w / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    fillRect(Math.round(cx - half), Math.round(cy - half), Math.ceil(w), Math.ceil(w), c);
  }
}
function poly(points, c) {
  // Scanline fill of a simple polygon.
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
    }
  }
}
function vGrad(x, y, w, h, top, bot) {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    const c = [Math.round(top[0] + (bot[0] - top[0]) * t), Math.round(top[1] + (bot[1] - top[1]) * t), Math.round(top[2] + (bot[2] - top[2]) * t)];
    fillRect(x, y + yy, w, 1, c);
  }
}
function frame(x, y, w, h, t, c) {
  fillRect(x, y, w, t, c); fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c); fillRect(x + w - t, y, t, h, c);
}
function arrow(x, y, len, c, w) {
  seg(x, y, x + len - 10, y, w, c);
  poly([[x + len - 10, y - 6], [x + len, y], [x + len - 10, y + 6]], c);
}

// ---- CRC32 + PNG (filter 0, RGB) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG() {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { png.set(p, off); off += p.length; }
  return png;
}

// ---- Vector stroke font: glyph = [advance, "M x,y L x,y ; M ..."] on a 6x10 grid, baseline y=7 ----
const G = {
  A: [6, "M0,7 L3,0 L6,7;M1.5,4.5 L4.5,4.5"],
  B: [6, "M0,7 L0,0 L3.5,0 L5.5,1.5 L3.5,3.5 L0,3.5;M3.5,3.5 L5.5,5.5 L3.5,7 L0,7"],
  C: [6, "M5.5,1.5 L3,0 L1,1.5 L0,3.5 L1,5.5 L3,7 L5.5,5.5"],
  D: [6, "M0,7 L0,0 L3.5,0 L5.5,2 L5.5,5 L3.5,7 L0,7"],
  E: [6, "M5.5,0 L0,0 L0,7 L5.5,7;M0,3.5 L4,3.5"],
  F: [6, "M0,7 L0,0 L5.5,0;M0,3.5 L4,3.5"],
  G: [6, "M5.5,1.5 L3,0 L1,1.5 L0,3.5 L1,5.5 L3,7 L5.5,7 L5.5,4 L3.5,4"],
  H: [6, "M0,0 L0,7;M6,0 L6,7;M0,3.5 L6,3.5"],
  I: [4, "M2,0 L2,7;M0.5,0 L3.5,0;M0.5,7 L3.5,7"],
  J: [5, "M4,0 L4,6 L3,7 L1,7 L0,6"],
  K: [6, "M0,0 L0,7;M5.5,0 L0,3.5 L5.5,7"],
  L: [6, "M0,0 L0,7 L5.5,7"],
  M: [7, "M0,7 L0,0 L3,3.5 L6,0 L6,7"],
  N: [6, "M0,7 L0,0 L6,7 L6,0"],
  O: [6, "M1.5,0 L4.5,0 L6,1.5 L6,5.5 L4.5,7 L1.5,7 L0,5.5 L0,1.5 L1.5,0"],
  P: [6, "M0,7 L0,0 L4,0 L5.5,1.5 L4,3.5 L0,3.5"],
  Q: [6, "M1.5,0 L4.5,0 L6,1.5 L6,5.5 L4.5,7 L1.5,7 L0,5.5 L0,1.5 L1.5,0;M3.5,5 L6,7"],
  R: [6, "M0,7 L0,0 L4,0 L5.5,1.5 L4,3.5 L0,3.5;M3,3.5 L6,7"],
  S: [6, "M5.5,1.5 L4,0 L2,0 L0.5,1.5 L0.5,3 L2,3.5 L4,3.5 L5.5,5 L5.5,6 L4,7 L2,7 L0.5,5.5"],
  T: [6, "M0,0 L6,0;M3,0 L3,7"],
  U: [6, "M0,0 L0,5.5 L1.5,7 L4.5,7 L6,5.5 L6,0"],
  V: [6, "M0,0 L3,7 L6,0"],
  W: [7, "M0,0 L1.5,7 L3,3.5 L4.5,7 L6,0"],
  X: [6, "M0,0 L6,7;M6,0 L0,7"],
  Y: [6, "M0,0 L3,3.5 L6,0;M3,3.5 L3,7"],
  Z: [6, "M0,0 L6,0 L0,7 L6,7"],
  "0": [6, "M1.5,0 L4.5,0 L6,1.5 L6,5.5 L4.5,7 L1.5,7 L0,5.5 L0,1.5 L1.5,0"],
  "1": [4, "M2.5,0 L2.5,7;M1,1.5 L2.5,0;M0.5,7 L4,7"],
  "2": [6, "M0.5,1.5 L2,0 L4,0 L5.5,1.5 L5.5,3 L0.5,7 L5.5,7"],
  "3": [6, "M0.5,1 L2,0 L4,0 L5.5,1.5 L4,3.5 L5.5,5.5 L4,7 L2,7 L0.5,6"],
  "4": [6, "M0.5,5 L3.5,0 L3.5,7;M0.5,5 L5,5"],
  "5": [6, "M5.5,0 L0.5,0 L0.5,3.5 L3.5,3.5 L5,5 L5,6 L3.5,7 L1.5,7 L0.5,6"],
  "6": [6, "M5,1 L3.5,0 L1.5,0.8 L0.5,2.5 L0.5,5.5 L1.5,7 L3.5,7 L5,5.5 L5,3.5 L3.5,3.5 L1.5,3.5"],
  "7": [6, "M0.5,0 L5.5,0 L2.5,7"],
  "8": [6, "M1.5,0 L4.5,0 L6,1.5 L4.5,3.5 L1.5,3.5 L0,1.5 L1.5,0;M1.5,3.5 L0,5.5 L1.5,7 L4.5,7 L6,5.5 L4.5,3.5"],
  "9": [6, "M1,6 L2.5,7 L4.5,7 L5.5,5.5 L5.5,1.5 L4.5,0 L2.5,0 L1,1.5 L1,3.5 L2.5,3.5 L4.5,3.5"],
};
Object.assign(G, {
  a: [6, "M5,3.5 L5,7;M0.5,7 L0.5,4.8 L1.5,3.5 L3.5,3.5 L5,4.8 L5,7 L0.5,7"],
  b: [6, "M0.5,0 L0.5,7;M5,4.8 L3.5,3.5 L0.5,3.5 L0.5,7 L3.5,7 L5,5.8 L5,4.8"],
  c: [6, "M5,4 L3.5,3.5 L1.5,3.5 L0.5,5 L0.5,5.8 L1.5,7 L3.5,7 L5,6"],
  d: [6, "M5,0 L5,7;M0.5,4.8 L1.5,3.5 L3.5,3.5 L5,4.8 L5,5.8 L3.5,7 L1.5,7 L0.5,5.8"],
  e: [6, "M0.5,5.2 L5,5.2;M5,4.8 L3.5,3.5 L1.5,3.5 L0.5,5 L0.5,5.8 L1.5,7 L3.5,7 L5,5.8"],
  f: [4.5, "M4,7 L4,1 L3,0 L1.5,0;M1,3.5 L4,3.5"],
  g: [6, "M5,3.5 L5,8.5 L3.5,10 L1.5,10 L0.5,9;M0.5,4.8 L1.5,3.5 L3.5,3.5 L5,4.8 L5,7 L3.5,7 L1.5,7 L0.5,5.8"],
  h: [6, "M0.5,0 L0.5,7;M0.5,5 L2,3.5 L3.5,3.5 L5,5 L5,7"],
  i: [3.5, "M2,3.5 L2,7;M2,0.8 L2,1.6"],
  j: [4.5, "M3.5,3.5 L3.5,8.5 L2.5,10 L1,10;M3.5,0.8 L3.5,1.6"],
  k: [6, "M0.5,0 L0.5,7;M5,3.5 L0.5,5.5 L5,7"],
  l: [3.5, "M2,0 L2,7"],
  m: [6.5, "M0.5,7 L0.5,3.5 L2,3.5 L2.5,5 L3,3.5 L4.5,3.5 L5,5 L5,7"],
  n: [6, "M0.5,7 L0.5,3.5 L3,3.5 L5,5 L5,7"],
  o: [6, "M1.5,3.5 L3.5,3.5 L5,5 L5,5.8 L3.5,7 L1.5,7 L0.5,5.8 L0.5,5 L1.5,3.5"],
  p: [6, "M0.5,3.5 L0.5,10;M0.5,7 L3.5,7 L5,5.8 L5,4.8 L3.5,3.5 L0.5,3.5"],
  q: [6, "M5,3.5 L5,10;M0.5,4.8 L1.5,3.5 L3.5,3.5 L5,4.8 L5,7 L0.5,7"],
  r: [5, "M0.5,7 L0.5,3.5 L3,3.5 L4.5,4.5 L4.5,5.5"],
  s: [6, "M4.5,4.2 L2.8,3.5 L1.2,3.9 L0.6,5 L1.6,5.6 L3.8,5.8 L4.8,6.6 L4,7.2 L2,7.2 L0.8,6.4"],
  t: [4.5, "M2.5,1 L2.5,6.2 L1.5,7 L3.5,7;M0.5,3.5 L4,3.5"],
  u: [6, "M0.5,3.5 L0.5,5.8 L1.5,7 L3.5,7 L5,5.8 L5,3.5"],
  v: [6, "M0.5,3.5 L2.5,7 L5,3.5"],
  w: [6.5, "M0.5,3.5 L1.5,7 L2.5,4.5 L3.5,7 L5.5,3.5"],
  x: [6, "M0.5,3.5 L5,7;M5,3.5 L0.5,7"],
  y: [6, "M0.5,3.5 L2.5,7 L5,3.5;M2.5,7 L2.5,9.5 L1,10"],
  z: [6, "M0.5,3.5 L5,3.5 L0.5,7 L5,7"],
  ".": [2.5, "M1.2,6.2 L1.2,7"],
  ",": [2.5, "M1.2,6.2 L1.2,7 L0.8,8.5 L0,9.5"],
  ":": [3, "M1.5,2.5 L1.5,3.3;M1.5,5.5 L1.5,6.3"],
  ";": [3, "M1.5,2.5 L1.5,3.3;M1.5,5.5 L1.5,6.3 L1,8 L0.3,9"],
  "'": [3, "M1.8,0 L1.3,2"],
  "-": [4, "M0.5,4.2 L3.5,4.2"],
  "\u2014": [7, "M0,4 L6,4"],
  "%": [6.5, "M5.5,0 L0.5,7;M1.8,0.8 L1.8,2.4;M0.6,0.8 L0.6,2.4;M5.4,4.6 L5.4,6.2;M4.2,4.6 L4.2,6.2"],
  "/": [5, "M4.5,0 L0.5,7"],
  "(": [5, "M4,0 L2,1.5 L1,3.5 L2,5.5 L4,7"],
  ")": [5, "M1,0 L3,1.5 L4,3.5 L3,5.5 L1,7"],
  "+": [6, "M3,1.5 L3,5.5;M1,3.5 L5,3.5"],
  "!": [3.5, "M1.8,0 L1.8,5;M1.8,6.2 L1.8,7"],
  "?": [6, "M1,1.5 L2,0.3 L4,0.3 L5,1.5 L5,2.8 L3,4 L3,5;M3,6.2 L3,7"],
  " ": [3, ""],
});

function drawGlyph(ch, x, y, s, w, c) {
  const g = G[ch];
  if (!g) return;
  const paths = g[1].split(";");
  for (const p of paths) {
    const cmds = p.trim().split(/\s+/);
    let cx = 0, cy = 0;
    for (const cmd of cmds) {
      if (!cmd) continue;
      const op = cmd[0];
      const [gx, gy] = cmd.slice(1).split(",").map(Number);
      if (op === "M") { cx = gx; cy = gy; }
      else if (op === "L") { seg(x + cx * s, y + cy * s, x + gx * s, y + gy * s, w, c); cx = gx; cy = gy; }
    }
  }
}
function textWidth(text, s, track) {
  let w = 0;
  for (const ch of text) { const g = G[ch]; w += (g ? g[0] : 3) * s + track; }
  return w - track;
}
function drawText(text, x, y, s, w, c, track = 0) {
  let cx = x;
  for (const ch of text) {
    const g = G[ch];
    if (g) drawGlyph(ch, cx, y, s, w, c);
    cx += ((g ? g[0] : 3) * s) + track;
  }
  return cx;
}
function centerText(text, cx, y, s, w, c, track = 0) {
  drawText(text, cx - textWidth(text, s, track) / 2, y, s, w, c, track);
}
function wrapText(text, s, maxW, track = 0) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, s, track) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(text, x, y, s, w, c, maxW, lh, track = 0) {
  const lines = wrapText(text, s, maxW, track);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, s, w, c, track));
  return lines.length;
}
function star(cx, cy, r, c) {
  poly([[cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy], [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28], [cx - r, cy], [cx - r * 0.28, cy - r * 0.28]], c);
}
function flagAU(x, y, w, h) {
  fillRect(x, y, w, h, BLUE);
  seg(x, y, x + w, y + h, 3, rgb("#ffffff"));
  seg(x + w, y, x, y + h, 3, rgb("#ffffff"));
  seg(x, y, x + w, y + h, 1.5, RED);
  seg(x + w, y, x, y + h, 1.5, RED);
  fillRect(x, y + h / 2 - 2, w, 4, rgb("#ffffff"));
  fillRect(x + w / 2 - 2, y, 4, h, rgb("#ffffff"));
  fillRect(x, y + h / 2 - 1, w, 2, RED);
  fillRect(x + w / 2 - 1, y, 2, h, RED);
  star(x + w * 0.72, y + h * 0.5, 7, rgb("#ffffff"));
  star(x + w * 0.88, y + h * 0.28, 3, rgb("#ffffff"));
  star(x + w * 0.88, y + h * 0.72, 3, rgb("#ffffff"));
}
function building(x, y, w, h, c) {
  fillRect(x, y + h * 0.3, w, h * 0.7, c);
  poly([[x + w * 0.1, y + h * 0.3], [x + w * 0.5, y], [x + w * 0.9, y + h * 0.3]], c);
  const cols = 5;
  for (let i = 0; i < cols; i++) {
    const cx = x + (w * (i + 0.5)) / cols;
    fillRect(cx - 4, y + h * 0.42, 8, h * 0.5, PAPER);
  }
  fillRect(x + w * 0.42, y + h * 0.72, w * 0.16, h * 0.28, INK);
}

// ---- Illustrated scenes (primitives only) ----
function sceneInflation(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#fdf6e3"));
  seg(x + 14, y + h - 16, x + 14, y + 14, 2, INK);
  seg(x + 14, y + h - 16, x + w - 10, y + h - 16, 2, INK);
  poly([[x + 20, y + h - 22], [x + w * 0.38, y + h * 0.62], [x + w * 0.58, y + h * 0.5], [x + w - 18, y + 20]], rgb("#ffffff"));
  seg(x + 20, y + h - 22, x + w * 0.38, y + h * 0.62, 4, RED);
  seg(x + w * 0.38, y + h * 0.62, x + w * 0.58, y + h * 0.5, 4, RED);
  seg(x + w * 0.58, y + h * 0.5, x + w - 18, y + 20, 4, RED);
  arrow(x + w - 52, y + 26, 34, RED, 4);
  disc(x + w - 30, y + h - 30, 13, GOLD);
  drawText("%", x + w - 38, y + h - 40, 1.6, 2, INK);
}
function sceneTube(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#22201c"));
  poly([[x + w * 0.2, y + h], [x + w * 0.32, y + h * 0.3], [x + w * 0.68, y + h * 0.3], [x + w * 0.8, y + h]], rgb("#3a372e"));
  fillRect(x + w * 0.3, y + h * 0.42, w * 0.4, h * 0.48, rgb("#c8102e"));
  fillRect(x + w * 0.3, y + h * 0.42, w * 0.4, 8, rgb("#ffffff"));
  fillRect(x + w * 0.36, y + h * 0.54, w * 0.12, h * 0.16, rgb("#bcd6e8"));
  fillRect(x + w * 0.52, y + h * 0.54, w * 0.12, h * 0.16, rgb("#bcd6e8"));
  disc(x + w * 0.5, y + h * 0.2, 11, RED);
  fillRect(x + w * 0.5 - 22, y + h * 0.2 - 4, 44, 8, BLUE);
  seg(x + 8, y + h - 8, x + w - 8, y + h - 8, 3, rgb("#8a8578"));
}
function sceneScales(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#f3ecd8"));
  seg(x + w * 0.2, y + h * 0.3, x + w * 0.8, y + h * 0.3, 3, INK);
  seg(x + w * 0.5, y + h * 0.3, x + w * 0.5, y + h * 0.75, 3, INK);
  disc(x + w * 0.2, y + h * 0.38, 12, GOLD);
  disc(x + w * 0.8, y + h * 0.38, 12, GOLD);
  fillRect(x + w * 0.34, y + h * 0.78, w * 0.32, 8, INK);
  building(x + w * 0.1, y + h * 0.5, w * 0.22, h * 0.4, rgb("#c9b98a"));
}
function sceneBars(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#f6ead9"));
  fillRect(x + w * 0.12, y + h * 0.2, w * 0.2, h * 0.68, TEAL);
  fillRect(x + w * 0.16, y + h * 0.08, w * 0.12, h * 0.14, TEAL);
  const bars = [0.3, 0.45, 0.62, 0.8];
  bars.forEach((f, i) => {
    fillRect(x + w * (0.44 + i * 0.14), y + h * (0.9 - f), w * 0.09, h * f, i === 3 ? RED : BLUE);
  });
}
function scenePeptide(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#eaf2f2"));
  fillRect(x + w * 0.16, y + h * 0.3, w * 0.2, h * 0.45, rgb("#ffffff"));
  frame(x + w * 0.16, y + h * 0.3, w * 0.2, h * 0.45, 2, INK);
  fillRect(x + w * 0.16, y + h * 0.55, w * 0.2, h * 0.2, TEAL);
  seg(x + w * 0.52, y + h * 0.25, x + w * 0.78, y + h * 0.6, 5, BLUE);
  seg(x + w * 0.78, y + h * 0.6, x + w * 0.86, y + h * 0.72, 2, INK);
  ring(x + w * 0.68, y + h * 0.42, 17, 3, RED);
}
function sceneFerry(x, y, w, h) {
  vGrad(x, y, w, h, rgb("#bcd6e8"), rgb("#e8dfc9"));
  poly([[x, y + h * 0.62], [x + w * 0.2, y + h * 0.52], [x + w * 0.4, y + h * 0.62], [x + w * 0.6, y + h * 0.52], [x + w * 0.8, y + h * 0.62], [x + w, y + h * 0.52], [x + w, y + h], [x, y + h]], BLUE);
  poly([[x + w * 0.2, y + h * 0.5], [x + w * 0.8, y + h * 0.5], [x + w * 0.72, y + h * 0.72], [x + w * 0.28, y + h * 0.72]], rgb("#ffffff"));
  fillRect(x + w * 0.32, y + h * 0.3, w * 0.36, h * 0.22, RED);
  seg(x + w * 0.5, y + h * 0.3, x + w * 0.5, y + h * 0.12, 2, INK);
  disc(x + w * 0.84, y + h * 0.24, 11, rgb("#ffffff"));
  seg(x + w * 0.84, y + h * 0.24, x + w * 0.84, y + h * 0.24 - 8, 2, INK);
  seg(x + w * 0.84, y + h * 0.24, x + w * 0.84 + 6, y + h * 0.24 + 2, 2, INK);
}
function sceneCouncil(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#efe8d2"));
  building(x + w * 0.3, y + h * 0.22, w * 0.4, h * 0.66, rgb("#b7a06a"));
  disc(x + w * 0.16, y + h * 0.72, 11, GOLD);
  disc(x + w * 0.84, y + h * 0.72, 11, GOLD);
  drawText("33", x + w * 0.42, y + h * 0.3, 2.2, 2, INK);
}
function sceneSummit(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#dbe8f2"));
  fillRect(x, y, w, 40, BLUE);
  for (let a = 0; a < 12; a++) {
    const rad = (a * Math.PI * 2) / 12 - Math.PI / 2;
    disc(x + w * 0.5 + 15 * Math.cos(rad), y + 20 + 15 * Math.sin(rad), 2.4, GOLD);
  }
  building(x + w * 0.3, y + h * 0.42, w * 0.4, h * 0.5, rgb("#b7a06a"));
}
function sceneChess(x, y, w, h) {
  fillRect(x, y, w, h, rgb("#efe8d2"));
  const sq = 10, bx = x + 3, by = y + 3;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) fillRect(bx + c * sq, by + r * sq, sq, sq, INK);
    }
  }
  frame(bx, by, 80, 80, 1, INK);
  disc(bx + 25, by + 25, 8, rgb("#ffffff"));
  ring(bx + 25, by + 25, 8, 2, INK);
  disc(bx + 55, by + 55, 8, INK);
  ring(bx + 55, by + 55, 8, 2, rgb("#ffffff"));
}

// ---- Data ----
const HEROES = [
  { scene: sceneSummit, badge: "SUMMIT OPENS", title: ["EU LEADERS", "MEET IN", "BRUSSELS"], deck: "Budget, Ukraine funds and the next ECB chief on the agenda.", src: "CONFIRMED - CONSILIUM" },
  { scene: sceneTube, badge: "1 OF 8", title: ["LONDON TUBE", "STRIKE BEGINS", "AT NOON"], deck: "First of eight stoppages. No Circle or Piccadilly line all day.", src: "CONFIRMED - TFL / RMT" },
  { scene: sceneBars, badge: "3.2M", title: ["DRUG SURVEY", "3.2M WOMEN", "HARMED"], deck: "Others drinking harmed 3.2M women in 2025, AIHW finds.", src: "CONFIRMED - AIHW" },
];
const CARDS = [
  { scene: sceneFerry, title: ["FERRIES STOP", "AT 07:30"], deck: "All Pittwater shut.", src: "CONFIRMED - MUA" },
  { scene: sceneCouncil, title: ["COUNCILS: 33", "FUNDING FIXES"], deck: "33 council fixes.", src: "CONFIRMED - PARLIAMENT" },
  { scene: scenePeptide, title: ["PEPTIDE", "INQUIRY OPENS"], deck: "MPs probe peptides.", src: "CONFIRMED - PARLIAMENT" },
  { scene: sceneScales, title: ["GAMBLING", "REFORM STALLS"], deck: "No reply in 2 years.", src: "CONFIRMED - WESLEY MISSION" },
  { scene: sceneInflation, title: ["BIG TECH", "RULES BACKED"], deck: "79% want more rules.", src: "REPORTED - ACCAN" },
  { scene: sceneChess, title: ["CHESS GAME 3", "IN GENEVA"], deck: "15:00 CET; level 1-1.", src: "CONFIRMED - FIDE" },
];
const ALSO = [
  ["10", "CONSTITUTION DAY", "77 years since 1949."],
  ["11", "THANKSGIVING IN US", "Markets shut for holiday."],
  ["12", "MIKTA IN CANBERRA", "Five nations; talks Fri."],
  ["13", "GENDER REPORT", "Equality aids security."],
  ["14", "AD CURBS BACKED", "74% back ad limits."],
];
const NUMBERS = [
  ["3.2M", "HARM FROM DRINKING"],
  ["33", "COUNCIL FIXES"],
  ["8", "TUBE WALKOUTS"],
  ["77", "YEARS ON"],
  ["79%", "WANT TECH RULES"],
  ["74%", "BACK AD CURBS"],
];
const TIMELINE = [
  ["07:30", "SYDNEY", "Ferries stop"],
  ["MORNING", "CANBERRA", "Reports tabled"],
  ["10:00", "BRUSSELS", "EU summit opens"],
  ["12:00", "LONDON", "Tube walkout begins"],
  ["15:00 CET", "GENEVA", "Chess Game 3"],
];
const DATECHECK = "LEFT OUT, ALL 25 NOV: veterans apology; CPI 4.9%; duty-of-care law; Blyth; trusts deal; fire ants; tuna study; home-birth rally; Hastie; ASX fall; glacier verdict; Deloitte ban; AFCA review. EARLIER: Indonesia fire; COP31; Shenzhou-24. No hook yet: East Asia, Africa, Middle East, S. America.";

// ---- Schematic dot-grid map ----
function drawMap(x, y, w, h) {
  const cols = 56, rows = 8;
  const cw = w / cols, ch = h / rows;
  const blobs = [
    [10, 3, 6, 3], [28, 2, 3, 1.6], [29, 4, 3, 2], [39, 2.5, 7, 2], [50, 6, 2.5, 1.2], [53, 6, 1.2, 0.9],
  ];
  const pins = [[10, 3], [28, 2], [30, 2], [38, 3], [50, 6], [53, 6]];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let land = false;
      for (const [bx, by, rx, ry] of blobs) {
        const dx = (c - bx) / rx, dy = (r - by) / ry;
        if (dx * dx + dy * dy <= 1) land = true;
      }
      const cx = x + (c + 0.5) * cw, cy = y + (r + 0.5) * ch;
      disc(cx, cy, land ? 2.4 : 1.3, land ? MIDGREY : rgb("#cfc6ae"));
    }
  }
  for (const [pc, pr] of pins) {
    disc(x + (pc + 0.5) * cw, y + (pr + 0.5) * ch, 4.5, RED);
  }
}

// ---- Page ----
function main() {
  fillRect(0, 0, W, H, PAPER);
  // Masthead
  hRule(24, 10, 976, 4, INK);
  centerText("THE DAY SO FAR - EARLY ON 26 NOVEMBER - MORNING IN CANBERRA", 512, 22, 1.55, 2, INK, 0.6);
  centerText("THE WORLD IN ONE DAY", 512, 40, 6.4, 4, INK, 1.2);
  centerText("THURSDAY 26 NOVEMBER 2026", 512, 92, 3.2, 3, RED, 1.5);
  hRule(24, 122, 976, 3, INK);
  hRule(24, 128, 976, 1, INK);
  // Meta bar
  drawText("OCEANIA 8  -  EUROPE 3  -  SOUTH ASIA 1  -  N. AMERICA 1  -  MULTI 1", 24, 136, 1.7, 2, INK, 0.4);
  const metaR = "14 STORIES - ALL DATED 26 NOV";
  drawText(metaR, 1000 - textWidth(metaR, 1.7, 0.4), 136, 1.7, 2, INK, 0.4);
  hRule(24, 154, 976, 1, MIDGREY);
  // Heroes
  const colW = 317, gap = 12;
  HEROES.forEach((hero, i) => {
    const x = 24 + i * (colW + gap), y = 162;
    hero.scene(x, y, colW, 104);
    frame(x, y, colW, 104, 2, INK);
    const badge = hero.badge;
    const bw = textWidth(badge, 1.7, 0.4) + 16;
    fillRect(x + colW - bw, y, bw, 22, RED);
    drawText(badge, x + colW - bw + 8, y + 4, 1.7, 2, rgb("#ffffff"), 0.4);
    let ty = y + 116;
    for (const ln of hero.title) { drawText(ln, x, ty, 3.4, 3, INK, 0.5); ty += 26; }
    const deckLines = wrapText(hero.deck, 1.85, colW);
    deckLines.forEach((ln, k) => drawText(ln, x, ty + 4 + k * 21, 1.85, 2, INK));
    drawText(hero.src, x, ty + 4 + deckLines.length * 21 + 6, 1.5, 2, GREY, 0.3);
  });
  hRule(24, 402, 976, 2, INK);
  // Cards
  const cardW = 317, cardH = 140, rowGap = 12;
  CARDS.forEach((card, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 24 + col * (cardW + gap), y = 410 + row * (cardH + rowGap);
    fillRect(x, y, cardW, cardH, rgb("#fffdf6"));
    frame(x, y, cardW, cardH, 1, MIDGREY);
    card.scene(x + 4, y + 4, 86, cardH - 8);
    frame(x + 4, y + 4, 86, cardH - 8, 1, INK);
    const tx = x + 98;
    let ty = y + 14;
    for (const ln of card.title) { drawText(ln, tx, ty, 2.6, 2, INK, 0.3); ty += 24; }
    drawText(card.deck, tx, y + 78, 1.8, 2, INK);
    drawText(card.src, tx, y + cardH - 16, 1.35, 2, GREY, 0.2);
  });
  hRule(24, 706, 976, 2, INK);
  // Also On (two columns of four)
  drawText("ALSO ON - 10 TO 14", 24, 714, 2.2, 2, INK, 0.5);
  hRule(24, 736, 556, 1, MIDGREY);
  ALSO.forEach((item, i) => {
    const col = i < 3 ? 0 : 1, row = i % 3;
    const x = 24 + col * 308, y = 744 + row * 52;
    drawText(item[0], x, y, 2.1, 2, RED, 0.3);
    drawText(item[1], x + 30, y, 2.1, 2, INK, 0.3);
    drawText(item[2], x + 30, y + 20, 1.7, 2, GREY, 0.2);
  });
  // Date Check + map (right column)
  const dx = 596, dw = 404;
  frame(dx, 714, dw, 188, 2, RED);
  drawText("DATE CHECK - LEFT OUT ON PURPOSE", dx + 10, 722, 1.9, 2, RED, 0.3);
  para(DATECHECK, dx + 10, 744, 1.3, 2, INK, dw - 20, 15);
  drawText("SCHEMATIC MAP - NOT TO SCALE", dx + 10, 846, 1.4, 2, GREY, 0.3);
  drawMap(dx + 12, 858, dw - 24, 20);
  drawText("PINS: BRUSSELS, LONDON, GENEVA, DELHI, CANBERRA, WASHINGTON", dx + 10, 886, 1.1, 1, GREY, 0.2);
  // Numbers strip
  hRule(24, 912, 976, 1, MIDGREY);
  NUMBERS.forEach((n, i) => {
    const x = 24 + i * 163;
    drawText(n[0], x, 920, 3.6, 3, RED, 0.5);
    drawText(n[1], x, 948, 1.4, 2, INK, 0.3);
    if (i) fillRect(x - 8, 918, 1, 36, MIDGREY);
  });
  hRule(24, 966, 976, 1, MIDGREY);
  // Timeline
  drawText("DAY SO FAR", 24, 974, 1.8, 2, RED, 0.4);
  TIMELINE.forEach((t, i) => {
    const x = 120 + i * 175;
    drawText(t[0] + " " + t[1], x, 974, 1.7, 2, INK, 0.3);
    drawText(t[2], x, 990, 1.55, 2, GREY, 0.2);
  });
  // Footer
  hRule(24, 1010, 976, 1, MIDGREY);
  drawText("SOURCES: CONSILIUM - TFL/RMT - AIHW - PARLIAMENT - MUA - WESLEY MISSION - ACCAN - FIDE - PIB. DRAWN IN CODE.", 24, 1016, 1.25, 1, GREY, 0.15);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}
main();
