// One day in the news — Thursday 26 November 2026.
// Draws a single 1024x1024 broadsheet PNG in code: Node stdlib only,
// no network, deterministic. Writes to $MAKEFUN_OUTPUT_DIR/entry.png
// (or /output/entry.png when unset).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function setPx(x: number, y: number, c: [number, number, number]): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, hex: string): void {
  const c = rgb(hex);
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; i += 3; }
  }
}
function disc(cx: number, cy: number, r: number, c: [number, number, number]): void {
  const rr = Math.max(0.5, r);
  for (let yy = Math.floor(cy - rr); yy <= Math.ceil(cy + rr); yy++)
    for (let xx = Math.floor(cx - rr); xx <= Math.ceil(cx + rr); xx++) {
      const dx = xx - cx, dy = yy - cy;
      if (dx * dx + dy * dy <= rr * rr) setPx(xx, yy, c);
    }
}
function line(x0: number, y0: number, x1: number, y1: number, hex: string, lw: number): void {
  const c = rgb(hex);
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  const r = Math.max(0.6, lw / 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
  }
}
function polyline(pts: [number, number][], hex: string, lw: number): void {
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hex, lw);
}
function polygon(pts: [number, number][], hex: string): void {
  // scanline fill for a simple polygon
  const c = rgb(hex);
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setPx(x, y, c);
  }
}
function circleFill(cx: number, cy: number, r: number, hex: string): void { disc(cx, cy, r, rgb(hex)); }
function circleStroke(cx: number, cy: number, r: number, hex: string, lw: number): void {
  const c = rgb(hex);
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    disc(cx + r * Math.cos(t), cy + r * Math.sin(t), Math.max(0.6, lw / 2), c);
  }
}
function rectStroke(x: number, y: number, w: number, h: number, hex: string, lw: number): void {
  line(x, y, x + w, y, hex, lw); line(x, y + h, x + w, y + h, hex, lw);
  line(x, y, x, y + h, hex, lw); line(x + w, y, x + w, y + h, hex, lw);
}

// ---- PNG encoder (filter 0, zlib deflate, CRC32) ----
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(idat)), chunk("IEND", new Uint8Array(0))];
  let len = 0; for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return Buffer.from(out);
}

// ---- Vector stroke font, designed for this page ----
// Glyphs are polylines on a 6-wide x 9-tall grid: cap top y=0,
// x-height top y=3, baseline y=7, descender y=9. Mixed case, drawn
// with round strokes so headlines survive shrinking to 300px.
const GLYPHS: Record<string, string[]> = {
  A: ["0,7 3,0 6,7", "1,5 5,5"],
  B: ["0,7 0,0 4,0 5,1 5,3 4,4 0,4", "0,4 4,4 5,5 5,6 4,7 0,7"],
  C: ["5,1 4,0 1,0 0,1 0,6 1,7 4,7 5,6"],
  D: ["0,7 0,0 4,0 6,2 6,5 4,7 0,7"],
  E: ["5,0 0,0 0,7 5,7", "0,3 4,3"],
  F: ["5,0 0,0 0,7", "0,3 4,3"],
  G: ["5,1 4,0 1,0 0,1 0,6 1,7 4,7 5,6 5,4 3,4"],
  H: ["0,0 0,7", "6,0 6,7", "0,3 6,3"],
  I: ["2,0 2,7", "0,0 4,0", "0,7 4,7"],
  J: ["4,0 4,6 3,7 1,7 0,6"],
  K: ["0,0 0,7", "6,0 0,3 6,7"],
  L: ["0,0 0,7 6,7"],
  M: ["0,7 0,0 3,3 6,0 6,7"],
  N: ["0,7 0,0 6,7 6,0"],
  O: ["1,0 4,0 5,1 5,6 4,7 1,7 0,6 0,1 1,0"],
  P: ["0,7 0,0 4,0 5,1 5,3 4,4 0,4"],
  Q: ["1,0 4,0 5,1 5,6 4,7 1,7 0,6 0,1 1,0", "3,5 6,7"],
  R: ["0,7 0,0 4,0 5,1 5,3 4,4 0,4", "2,4 6,7"],
  S: ["5,1 4,0 1,0 0,1 0,3 1,4 4,4 5,5 5,6 4,7 1,7 0,6"],
  T: ["0,0 6,0", "3,0 3,7"],
  U: ["0,0 0,6 1,7 5,7 6,6 6,0"],
  V: ["0,0 3,7 6,0"],
  W: ["0,0 1,7 3,3 5,7 6,0"],
  X: ["0,0 6,7", "6,0 0,7"],
  Y: ["0,0 3,3 3,7", "6,0 3,3"],
  Z: ["0,0 6,0 0,7 6,7"],
  "0": ["1,0 4,0 5,1 5,6 4,7 1,7 0,6 0,1 1,0", "1,6 4,1"],
  "1": ["1,1 2,0 2,7", "0,7 4,7"],
  "2": ["0,1 1,0 4,0 5,1 5,3 0,7 5,7"],
  "3": ["0,1 1,0 4,0 5,1 5,3 4,4 5,5 5,6 4,7 1,7 0,6"],
  "4": ["0,0 0,4 5,4", "3,0 3,7"],
  "5": ["5,0 0,0 0,4 4,4 5,5 5,6 4,7 1,7 0,6"],
  "6": ["5,1 4,0 1,0 0,1 0,6 1,7 4,7 5,6 5,4 4,3 1,3 0,4"],
  "7": ["0,0 5,0 2,7"],
  "8": ["1,0 4,0 5,1 5,3 4,4 1,4 0,3 0,1 1,0", "0,4 1,4 4,4 5,5 5,6 4,7 1,7 0,6 0,5"],
  "9": ["0,6 1,7 4,7 5,6 5,1 4,0 1,0 0,1 0,3 1,4 4,4 5,3"],
  a: ["0,4 0,6 1,7 3,7 4,6 4,3 3,3 1,3 0,4", "4,3 4,7"],
  b: ["0,0 0,7", "0,3 1,3 3,3 4,4 4,6 3,7 1,7 0,6"],
  c: ["4,4 3,3 1,3 0,4 0,6 1,7 3,7 4,6"],
  d: ["5,0 5,7", "1,3 3,3 4,4 4,6 3,7 1,7 0,6 0,4 1,3"],
  e: ["4,6 3,7 1,7 0,6 0,4 1,3 3,3 4,4 0,4"],
  f: ["2,1 3,0 3,7", "1,2 4,2"],
  g: ["0,4 0,6 1,7 3,7 4,6 4,4 3,3 1,3 0,4", "4,3 4,8 3,9 1,9 0,8"],
  h: ["0,0 0,7", "0,3 1,3 3,3 4,4 4,7"],
  i: ["2,0 2,1", "2,3 2,7"],
  j: ["3,3 3,8 2,9 1,9 0,8", "3,0 3,1"],
  k: ["0,0 0,7", "4,3 0,5 4,7"],
  l: ["2,0 2,7"],
  m: ["0,7 0,3 2,3 2,7", "2,4 3,3 4,3 5,4 5,7"],
  n: ["0,7 0,3 1,3 3,3 4,4 4,7"],
  o: ["1,3 3,3 4,4 4,6 3,7 1,7 0,6 0,4 1,3"],
  p: ["0,3 0,9", "0,3 3,3 4,4 4,6 3,7 1,7 0,6"],
  q: ["5,3 5,9", "1,3 3,3 4,4 4,6 3,7 1,7 0,6 0,4 1,3"],
  r: ["0,7 0,3 1,3 3,3 4,4"],
  s: ["4,4 3,3 1,3 0,4 0,5 1,6 3,6 4,7 4,6"],
  t: ["2,0 2,7 4,6", "0,2 4,2"],
  u: ["0,3 0,6 1,7 3,7 4,6 4,3"],
  v: ["0,3 2,7 4,3"],
  w: ["0,3 1,7 2,4 3,7 4,3"],
  x: ["0,3 4,7", "4,3 0,7"],
  y: ["0,3 2,6 4,3", "2,6 2,9 1,9 0,8"],
  z: ["0,3 4,3 0,7 4,7"],
  " ": [],
  ".": ["2,7 2,7"],
  ",": ["2,7 2,7", "2,7 1,9"],
  ":": ["2,2 2,2", "2,6 2,6"],
  ";": ["2,2 2,2", "2,6 2,6", "2,6 1,9"],
  "!": ["2,0 2,5", "2,7 2,7"],
  "?": ["0,1 1,0 4,0 5,1 5,3 4,4 2,4", "2,6 2,6"],
  "'": ["2,0 1,2"],
  '"': ["1,0 0,2", "4,0 3,2"],
  "-": ["0,4 5,4"],
  "–": ["0,4 6,4"],
  "—": ["0,4 6,4"],
  "(": ["4,0 2,2 2,5 4,7"],
  ")": ["1,0 3,2 3,5 1,7"],
  "/": ["4,0 1,7"],
  "%": ["0,0 5,7", "0,1 1,1 1,2 0,2 0,1", "4,5 5,5 5,6 4,6 4,5"],
  "+": ["0,3 5,3", "2,1 2,6"],
  "=": ["0,2 5,2", "0,5 5,5"],
  "&": ["4,0 2,2 0,4 1,6 3,6 4,5 2,3 4,1"],
  "*": ["2,0 2,7", "0,2 4,5", "4,2 0,5"],
  "#": ["1,0 1,7", "4,0 4,7", "0,2 5,2", "0,5 5,5"],
  "@": ["4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 3,2 2,2 2,4 2,5 3,5"],
  _: ["0,7 5,7"],
  "•": ["1,3 3,3 3,5 1,5 1,3"],
  "·": ["2,4 2,4"],
  $: ["0,2 1,1 3,1 4,2 4,3 3,4 1,4 0,5 0,6 1,7 3,7 4,6", "2,0 2,8"],
  "£": ["4,0 1,0 0,1 0,6 1,7 4,7", "0,3 3,3", "1,5 1,6"],
  "€": ["5,1 4,0 1,0 0,1 0,6 1,7 4,7 5,6", "0,3 4,3", "0,5 4,5"],
  "°": ["1,0 2,0 2,1 1,1 1,0"],
  "×": ["0,1 3,4", "3,1 0,4"],
  "→": ["0,3 5,3", "3,1 5,3 3,5"],
  "↑": ["2,6 2,0", "0,2 2,0 4,2"],
  "↓": ["2,0 2,6", "0,4 2,6 4,4"],
};
const GLYPH_W: Record<string, number> = {
  I: 4, J: 4, i: 3, l: 3, j: 3, f: 4, t: 4, r: 4, " ": 3, ".": 3, ",": 3,
  ":": 3, ";": 3, "!": 3, "'": 3, '"': 5, "-": 5, "–": 6, "—": 6,
  "(": 4, ")": 4, "/": 5, "%": 6, "+": 5, "=": 5, "&": 5, "*": 5,
  "#": 6, "@": 6, _: 5, "•": 4, "·": 3, $: 5, "£": 5, "€": 5, "°": 3,
  "×": 4, "→": 6, "↑": 4, "↓": 4, M: 6, W: 6, m: 6, w: 5, V: 6, A: 6, Q: 6,
};
function glyphWidth(ch: string): number { return GLYPH_W[ch] ?? 6; }
function drawGlyph(ch: string, x: number, y: number, size: number, hex: string, lw: number): number {
  const strokes = GLYPHS[ch];
  const s = size / 9;
  const sx = s * 0.82;
  if (strokes) {
    for (const st of strokes) {
      const pts = st.split(" ").map((p) => {
        const [px, py] = p.split(",").map(Number);
        return [x + px * sx, y + py * s] as [number, number];
      });
      if (pts.length === 1) { disc(pts[0][0], pts[0][1], Math.max(0.7, lw / 2 + 0.4), rgb(hex)); }
      else polyline(pts, hex, lw);
    }
  }
  return (glyphWidth(ch) + 1.6) * sx;
}
function textWidth(text: string, size: number): number {
  const sx = (size / 9) * 0.82;
  let w = 0;
  for (const ch of text) w += (glyphWidth(ch) + 1.6) * sx;
  return w;
}
function drawText(x: number, y: number, size: number, text: string, hex: string): number {
  const lw = Math.max(1, Math.round(size * 0.11));
  let cx = x;
  for (const ch of text) cx += drawGlyph(ch, cx, y, size, hex, lw);
  return cx - x;
}
function drawTextC(x: number, y: number, size: number, text: string, hex: string, maxW: number): void {
  // centred on x
  drawText(x - textWidth(text, size) / 2, y, size, text, hex);
}
function wrapLines(text: string, size: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, size) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, size: number, text: string, hex: string, maxW: number, lh: number): number {
  const lines = wrapLines(text, size, maxW);
  lines.forEach((ln, i) => drawText(x, y + i * lh, size, ln, hex));
  return lines.length;
}

// ---- small drawn scenes (primitives only) ----
function sceneParliament(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, "#BFD9E8");
  fillRect(x + w * 0.08, y + h * 0.55, w * 0.84, h * 0.45, "#E8E2D2");
  polygon([[x + w * 0.3, y + h * 0.18], [x + w * 0.7, y + h * 0.18], [x + w * 0.5, y + h * 0.05]], "#8A97A5");
  for (let i = 0; i < 5; i++) fillRect(x + w * (0.12 + i * 0.16), y + h * 0.3, w * 0.07, h * 0.3, "#F6F1E3");
}
function sceneChart(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, "#14243E");
  line(x + w * 0.1, y + h * 0.85, x + w * 0.9, y + h * 0.85, "#F6F1E3", 2);
  line(x + w * 0.1, y + h * 0.85, x + w * 0.1, y + h * 0.15, "#F6F1E3", 2);
  polyline([[x + w * 0.15, y + h * 0.6], [x + w * 0.35, y + h * 0.55], [x + w * 0.55, y + h * 0.4], [x + w * 0.85, y + h * 0.15]], "#F59E0B", 4);
  polygon([[x + w * 0.85, y + h * 0.15], [x + w * 0.72, y + h * 0.18], [x + w * 0.82, y + h * 0.3]], "#F59E0B");
  fillRect(x + w * 0.62, y + h * 0.55, w * 0.1, h * 0.3, "#C1272D");
  fillRect(x + w * 0.76, y + h * 0.62, w * 0.1, h * 0.23, "#C1272D");
}
function sceneTube(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, "#F3E9D2");
  fillRect(x, y + h * 0.62, w, h * 0.38, "#3A3A3A");
  fillRect(x + w * 0.06, y + h * 0.18, w * 0.55, h * 0.42, "#C1272D");
  fillRect(x + w * 0.1, y + h * 0.24, w * 0.47, h * 0.3, "#F6F1E3");
  circleFill(x + w * 0.78, y + h * 0.34, h * 0.2, "#C1272D");
  fillRect(x + w * 0.7, y + h * 0.3, w * 0.16, h * 0.08, "#1D4ED8");
  line(x + w * 0.66, y + h * 0.06, x + w * 0.9, y + h * 0.06, "#141414", 2);
  line(x + w * 0.66, y + h * 0.06, x + w * 0.66, y + h * 0.22, "#141414", 2);
}
function iconBox(x: number, y: number, s: number, bg: string): void {
  fillRect(x, y, s, s, bg);
  rectStroke(x, y, s, s, "#141414", 1);
}
function drawIcon(kind: string, x: number, y: number, s: number): void {
  const u = s / 30;
  switch (kind) {
    case "rate": // rising arrow + coin
      circleFill(x + 9 * u, y + 21 * u, 7 * u, "#D97706");
      polyline([[x + 3 * u, y + 22 * u], [x + 12 * u, y + 14 * u], [x + 20 * u, y + 17 * u], [x + 27 * u, y + 6 * u]], "#141414", 3);
      polygon([[x + 27 * u, y + 6 * u], [x + 20 * u, y + 6 * u], [x + 26 * u, y + 13 * u]], "#141414");
      break;
    case "eu": // circle of stars
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        disc(x + 15 * u + 10 * u * Math.cos(a), y + 15 * u + 10 * u * Math.sin(a), 2 * u, rgb("#F59E0B"));
      }
      break;
    case "fire":
      polygon([[x + 15 * u, y + 2 * u], [x + 24 * u, y + 14 * u], [x + 27 * u, y + 22 * u], [x + 20 * u, y + 28 * u], [x + 10 * u, y + 28 * u], [x + 3 * u, y + 22 * u], [x + 6 * u, y + 14 * u]], "#EA580C");
      polygon([[x + 15 * u, y + 12 * u], [x + 21 * u, y + 20 * u], [x + 18 * u, y + 26 * u], [x + 12 * u, y + 26 * u], [x + 9 * u, y + 20 * u]], "#F59E0B");
      break;
    case "leaf":
      polygon([[x + 15 * u, y + 2 * u], [x + 26 * u, y + 12 * u], [x + 15 * u, y + 28 * u], [x + 4 * u, y + 12 * u]], "#0F766E");
      line(x + 15 * u, y + 4 * u, x + 15 * u, y + 27 * u, "#F6F1E3", 2);
      break;
    case "oil":
      fillRect(x + 6 * u, y + 6 * u, 18 * u, 20 * u, "#1F2937");
      line(x + 6 * u, y + 12 * u, x + 24 * u, y + 12 * u, "#F59E0B", 2);
      line(x + 6 * u, y + 20 * u, x + 24 * u, y + 20 * u, "#F59E0B", 2);
      disc(x + 15 * u, y + 26 * u, 3 * u, rgb("#F59E0B"));
      break;
    case "wave":
      polyline([[x + 2 * u, y + 10 * u], [x + 8 * u, y + 6 * u], [x + 14 * u, y + 12 * u], [x + 20 * u, y + 6 * u], [x + 28 * u, y + 10 * u]], "#1D4ED8", 3);
      polyline([[x + 2 * u, y + 20 * u], [x + 8 * u, y + 16 * u], [x + 14 * u, y + 22 * u], [x + 20 * u, y + 16 * u], [x + 28 * u, y + 20 * u]], "#1D4ED8", 3);
      break;
    case "storm":
      polygon([[x + 8 * u, y + 6 * u], [x + 14 * u, y + 2 * u], [x + 22 * u, y + 4 * u], [x + 26 * u, y + 10 * u], [x + 24 * u, y + 15 * u], [x + 6 * u, y + 15 * u]], "#475569");
      polyline([[x + 16 * u, y + 15 * u], [x + 11 * u, y + 22 * u], [x + 17 * u, y + 22 * u], [x + 12 * u, y + 28 * u]], "#F59E0B", 3);
      break;
    case "doc":
      fillRect(x + 8 * u, y + 3 * u, 14 * u, 24 * u, "#F6F1E3");
      rectStroke(x + 8 * u, y + 3 * u, 14 * u, 24 * u, "#141414", 1);
      line(x + 11 * u, y + 9 * u, x + 19 * u, y + 9 * u, "#1D4ED8", 2);
      line(x + 11 * u, y + 14 * u, x + 19 * u, y + 14 * u, "#1D4ED8", 2);
      line(x + 11 * u, y + 19 * u, x + 19 * u, y + 19 * u, "#1D4ED8", 2);
      break;
    case "chess":
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
        if ((r + c) % 2 === 0) fillRect(x + 3 * u + c * 6 * u, y + 3 * u + r * 6 * u, 6 * u, 6 * u, "#141414");
      rectStroke(x + 3 * u, y + 3 * u, 24 * u, 24 * u, "#141414", 1);
      break;
    case "book":
      fillRect(x + 5 * u, y + 4 * u, 20 * u, 22 * u, "#7C2D12");
      fillRect(x + 8 * u, y + 7 * u, 14 * u, 16 * u, "#F6F1E3");
      line(x + 11 * u, y + 11 * u, x + 19 * u, y + 11 * u, "#141414", 2);
      line(x + 11 * u, y + 16 * u, x + 19 * u, y + 16 * u, "#141414", 2);
      break;
    case "market":
      polyline([[x + 3 * u, y + 24 * u], [x + 10 * u, y + 16 * u], [x + 16 * u, y + 19 * u], [x + 27 * u, y + 6 * u]], "#0F766E", 3);
      fillRect(x + 5 * u, y + 18 * u, 4 * u, 8 * u, "#0F766E");
      fillRect(x + 13 * u, y + 12 * u, 4 * u, 14 * u, "#0F766E");
      fillRect(x + 21 * u, y + 6 * u, 4 * u, 20 * u, "#0F766E");
      break;
    case "server":
      fillRect(x + 5 * u, y + 4 * u, 20 * u, 22 * u, "#334155");
      fillRect(x + 8 * u, y + 7 * u, 14 * u, 4 * u, "#F59E0B");
      fillRect(x + 8 * u, y + 14 * u, 14 * u, 4 * u, "#F59E0B");
      fillRect(x + 8 * u, y + 21 * u, 14 * u, 4 * u, "#38BDF8");
      break;
    default:
      circleFill(x + 15 * u, y + 15 * u, 8 * u, "#1D4ED8");
  }
}

// ---- dot-grid world map (schematic) ----
function drawMap(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, "#DCE9F2");
  rectStroke(x, y, w, h, "#141414", 1);
  // land blobs as dot grids: [cx, cy, rx, ry] in map coords
  const blobs: [number, number, number, number][] = [
    [0.16, 0.32, 0.10, 0.16], [0.30, 0.28, 0.07, 0.12], [0.50, 0.24, 0.10, 0.13],
    [0.62, 0.32, 0.09, 0.15], [0.72, 0.30, 0.07, 0.11], [0.84, 0.38, 0.08, 0.12],
    [0.52, 0.55, 0.06, 0.10], [0.30, 0.62, 0.05, 0.14], [0.86, 0.68, 0.05, 0.09],
  ];
  const step = 11;
  for (let gy = y + 8; gy < y + h - 6; gy += step)
    for (let gx = x + 8; gx < x + w - 6; gx += step) {
      const nx = (gx - x) / w, ny = (gy - y) / h;
      let land = false;
      for (const [bx, by, rx, ry] of blobs) {
        const dx = (nx - bx) / rx, dy = (ny - by) / ry;
        if (dx * dx + dy * dy <= 1) { land = true; break; }
      }
      disc(gx, gy, land ? 2.2 : 1.1, rgb(land ? "#5B7A94" : "#B9CFDE"));
    }
  const pins: [number, number, string, number][] = [
    [0.86, 0.70, "CANBERRA", -1], [0.50, 0.22, "LONDON", 1], [0.72, 0.30, "SEOUL", 1],
    [0.62, 0.38, "DELHI", 1], [0.16, 0.34, "NEW YORK", 1], [0.55, 0.52, "GULF", 1],
    [0.30, 0.66, "SANTIAGO", 1],
  ];
  for (const [px, py, label, side] of pins) {
    const cx = x + px * w, cy = y + py * h;
    disc(cx, cy, 5, rgb("#C1272D")); disc(cx, cy, 2, rgb("#F6F1E3"));
    const lw2 = textWidth(label, 10);
    drawText(side < 0 ? cx - 8 - lw2 : cx + 8, cy - 5, 10, label, "#141414");
  }
  drawText(x + 10, y + h - 16, 12, "Dots: where the day's news happened", "#334155");
}

// ---- data ----
type Story = { n: string; title: string; deck: string; tag: string; icon: string; bg: string };
const HEROES: { title: string; deck: string; tag: string; scene: string; src: string }[] = [
  { title: "EU summit opens in Brussels", deck: "Leaders clash over budget and EUR45bn Ukraine loan; no deal expected.", tag: "EUROPE · SUMMIT · REPORTED", scene: "parliament", src: "Reuters" },
  { title: "Korea raises rates to 3.25%", deck: "Bank of Korea lifts base rate 25bp, 5-2 vote; growth forecast raised.", tag: "E ASIA · ECONOMY · CONFIRMED", scene: "chart", src: "Reuters" },
  { title: "Tube strike begins at noon", deck: "RMT 24-hour walkout, first of 8. No Circle or Piccadilly all day.", tag: "EUROPE · TRANSPORT · CONFIRMED", scene: "tube", src: "TfL / RMT" },
];
const CARDS: Story[] = [
  { n: "4", title: "Flinders Island fire", deck: "6 properties hit; 14,000 ha burn, 10% of island.", tag: "OCEANIA · REPORTED", icon: "fire", bg: "#FFEDD5" },
  { n: "5", title: "2035 target slips away", deck: "Australia on track for a 48% cut, not 62-70%.", tag: "OCEANIA · CONFIRMED", icon: "leaf", bg: "#D1FAE5" },
  { n: "6", title: "Oil nears $95", deck: "Brent $94.71 as Hormuz mine reports disrupt shipping.", tag: "MID EAST · REPORTED", icon: "oil", bg: "#FEF3C7" },
  { n: "7", title: "King tides flood coast", deck: "Peak tides; flood warnings run to Thu 4pm.", tag: "N AMERICA · REPORTED", icon: "wave", bg: "#DBEAFE" },
  { n: "8", title: "Storm hits Thanksgiving", deck: "Nor'easter lashes East Coast; 60-70 mph gusts.", tag: "N AMERICA · REPORTED", icon: "storm", bg: "#E0E7FF" },
  { n: "9", title: "UK-EU treaties out", deck: "Two texts out; 10-year exit-cost clause.", tag: "EUROPE · REPORTED", icon: "doc", bg: "#DBEAFE" },
  { n: "10", title: "Chess: Game 3 today", deck: "1-1; Sindarov White, 15:00 CET, Geneva.", tag: "EUROPE · SCHEDULE", icon: "chess", bg: "#F3E8FF" },
  { n: "11", title: "Constitution Day", deck: "India marks 77 years since the 1949 adoption.", tag: "S ASIA · CONFIRMED", icon: "book", bg: "#FFEDD5" },
  { n: "12", title: "Asia markets rebound", deck: "Nikkei, Kospi and Taiex rise after Wall St fightback.", tag: "E ASIA · REPORTED", icon: "market", bg: "#D1FAE5" },
  { n: "13", title: "Homes v data centres", deck: "Kashiwa revolt as centres loom over homes.", tag: "E ASIA · REPORTED", icon: "server", bg: "#E0E7FF" },
  { n: "14", title: "PBS freeze passes", deck: "Senate passes script-price freeze to 2030.", tag: "OCEANIA · CONFIRMED", icon: "doc", bg: "#D1FAE5" },
  { n: "15", title: "Channel boat dealer exposed", deck: "BBC: firm linked to a third of crossings.", tag: "EUROPE · REPORTED", icon: "wave", bg: "#FEF3C7" },
];
const ALSO: [string, string, string][] = [
  ["16", "Blyth fronts media with Hanson", "OCEANIA"],
  ["17", "Trusts tax passes Parliament", "OCEANIA"],
  ["18", "3m women hurt by others' drinking", "OCEANIA"],
  ["19", "Ferries stop from 07:30", "OCEANIA"],
  ["20", "Councils: 33 funding fixes", "OCEANIA"],
  ["21", "Gambling reform 'a monument to inaction'", "OCEANIA"],
  ["22", "Davis Cup quarters in Bologna today", "EUROPE"],
  ["23", "UK seasons shift: fewer frosts", "EUROPE"],
  ["24", "Congress marks Constitution Day", "S ASIA"],
  ["25", "Correios strike due at 22:00", "S AMERICA"],
  ["26", "Poland's president lectures in Santiago", "S AMERICA"],
  ["27", "Copa flies Panama-Margarita", "S AMERICA"],
  ["28", "Mumbai marks 26/11 anniversary", "S ASIA"],
  ["29", "Cook Strait ferry designs out", "OCEANIA"],
  ["30", "Health NZ rehires 166 it cut", "OCEANIA"],
  ["31", "Fuego ash plume to 14,000 ft", "N AMERICA"],
];

// ---- build the page ----
function build(): void {
  fillRect(0, 0, W, H, "#F6F1E3");
  // Masthead
  fillRect(0, 0, W, 86, "#14243E");
  drawText(18, 10, 14, "THE WORLD IN ONE PAGE", "#F59E0B");
  drawText(18, 28, 38, "Thursday 26 November 2026", "#F6F1E3");
  const right = "31 STORIES  ·  7 REGIONS";
  drawText(W - 18 - textWidth(right, 16), 12, 16, right, "#F6F1E3");
  drawText(W - 18 - textWidth("All of one day's news", 13), 34, 13, "All of one day's news", "#BFD9E8");
  drawText(W - 18 - textWidth("Happened or first reported today", 13), 52, 13, "Happened or first reported today", "#BFD9E8");
  // Numbers strip
  fillRect(0, 86, W, 30, "#C1272D");
  drawTextC(W / 2, 95, 14, "3.25% Korea rate  ·  $94.71 Brent  ·  48% by 2035  ·  14,000 ha  ·  +1.3% Nikkei  ·  166 rehired", "#F6F1E3", W);
  // Heroes
  const hw = 328, hx = [16, 348, 680];
  HEROES.forEach((hs, i) => {
    const x = hx[i], y = 124;
    fillRect(x, y, hw, 196, "#FFFFFF");
    rectStroke(x, y, hw, 196, "#141414", 2);
    if (hs.scene === "parliament") sceneParliament(x + 10, y + 8, hw - 20, 60);
    else if (hs.scene === "chart") sceneChart(x + 10, y + 8, hw - 20, 60);
    else sceneTube(x + 10, y + 8, hw - 20, 60);
    const tlines = wrapLines(hs.title, 23, hw - 20).slice(0, 2);
    tlines.forEach((ln, k) => drawText(x + 10, y + 76 + k * 26, 23, ln, "#141414"));
    drawPara(x + 10, y + 130, 13, hs.deck, "#333333", hw - 20, 16);
    fillRect(x + 10, y + 176, hw - 20, 1, "#999999");
    drawText(x + 10, y + 182, 10, hs.tag + "  ·  " + hs.src, "#666666");
  });
  // Cards: 4 columns x 3 rows
  const cw = 242, ch = 84, cgx = 8, cgy = 8;
  CARDS.forEach((cd, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 16 + col * (cw + cgx), y = 328 + row * (ch + cgy);
    fillRect(x, y, cw, ch, "#FFFFFF");
    rectStroke(x, y, cw, ch, "#141414", 1);
    iconBox(x + 8, y + 8, 34, cd.bg);
    drawIcon(cd.icon, x + 8, y + 8, 34);
    const ct = wrapLines(cd.n + ". " + cd.title, 15, cw - 56).slice(0, 2);
    ct.forEach((ln, k) => drawText(x + 48, y + 6 + k * 17, 15, ln, "#141414"));
    drawPara(x + 48, y + 42, 11, cd.deck, "#333333", cw - 56, 13);
    drawText(x + 48, y + ch - 14, 10, cd.tag, "#666666");
  });
  // Map + timeline band
  const my = 600, mh = 112;
  drawMap(16, my, 496, mh);
  fillRect(520, my, 488, mh, "#14243E");
  rectStroke(520, my, 488, mh, "#141414", 1);
  drawText(534, my + 8, 13, "THE DAY IN LOCAL TIMES", "#F59E0B");
  const tl: [string, string][] = [
    ["07:30", "Sydney: ferries stop"],
    ["Morning", "Canberra: PBS freeze passes"],
    ["Morning", "Seoul: rates to 3.25%"],
    ["12:00", "London: Tube walkout"],
    ["15:00", "Geneva: Chess Game 3"],
    ["16:00", "Santiago: ECLAC lecture"],
    ["22:00", "Brasilia: postal strike due"],
  ];
  tl.forEach(([t, s], i) => {
    const yy = my + 26 + i * 12;
    drawText(534, yy, 10, t, "#F59E0B");
    drawText(606, yy, 10, s, "#F6F1E3");
  });
  // Also on
  const ay = 720;
  drawText(16, ay, 19, "ALSO ON 26 NOVEMBER", "#141414");
  fillRect(16, ay + 25, W - 32, 2, "#C1272D");
  const colW = 328, rowH = 32;
  ALSO.forEach(([n, t, region], i) => {
    const col = Math.floor(i / 7), row = i % 7;
    const x = 16 + col * colW, y = ay + 31 + row * rowH;
    drawText(x, y + 2, 14, n + ".", "#C1272D");
    const lines = wrapLines(t, 14, colW - 118).slice(0, 2);
    drawText(x + 28, y + 2, 14, lines[0] ?? t, "#141414");
    if (lines[1]) drawText(x + 28, y + 16, 12, lines[1], "#141414");
    drawText(x + colW - 76, y + 3, 10, region, "#666666");
  });
  // Date check footer
  const fy = 976;
  fillRect(0, fy, W, H - fy, "#14243E");
  drawText(16, fy + 6, 12, "DATE CHECK — left out as 25 Nov: veterans apology, CPI 4.9%, duty-of-care law, Blyth switch, fire ants,", "#F6F1E3");
  drawText(16, fy + 20, 12, "home-birth rally, Hastie jobs, Essential poll, Victoria AI plan, 2C record, peptide inquiry, party rename,", "#F6F1E3");
  drawText(16, fy + 34, 12, "Solomon treaty, Cairo fire, tariffs, Hera images, Ramaphosa ruling. No verified Africa hook found.", "#F59E0B");
}

function main(): void {
  build();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}
main();
