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
function sceneDrone(x: number, y: number, w: number, h: number): void {
  // Air-defence site under a drone attack: radar dish, launcher, drone, blast.
  fillRect(x, y, w, h, "#BFD9E8");
  fillRect(x, y + h * 0.72, w, h * 0.28, "#8A7B5C");
  // radar dish on a mast
  line(x + w * 0.18, y + h * 0.72, x + w * 0.18, y + h * 0.38, "#334155", 3);
  polygon([[x + w * 0.08, y + h * 0.42], [x + w * 0.28, y + h * 0.42], [x + w * 0.18, y + h * 0.26]], "#E2E8F0");
  line(x + w * 0.08, y + h * 0.42, x + w * 0.28, y + h * 0.42, "#334155", 2);
  // missile launcher
  fillRect(x + w * 0.55, y + h * 0.62, w * 0.22, h * 0.1, "#475569");
  line(x + w * 0.60, y + h * 0.62, x + w * 0.74, y + h * 0.40, "#1F2937", 5);
  // drone silhouette
  const dx = x + w * 0.68, dy = y + h * 0.16;
  fillRect(dx - w * 0.05, dy - 2, w * 0.1, 5, "#141414");
  disc(dx - w * 0.06, dy - 3, 5, rgb("#141414")); disc(dx + w * 0.06, dy - 3, 5, rgb("#141414"));
  line(dx - w * 0.09, dy - 3, dx - w * 0.03, dy - 3, "#141414", 2);
  line(dx + w * 0.03, dy - 3, dx + w * 0.09, dy - 3, "#141414", 2);
  // explosion burst + smoke over the site
  const ex = x + w * 0.36, ey = y + h * 0.34;
  polygon([[ex, ey - h * 0.22], [ex + w * 0.03, ey - h * 0.06], [ex + w * 0.08, ey - h * 0.12], [ex + w * 0.04, ey + h * 0.02], [ex + w * 0.07, ey + h * 0.14], [ex, ey + h * 0.05], [ex - w * 0.07, ey + h * 0.14], [ex - w * 0.04, ey + h * 0.02], [ex - w * 0.08, ey - h * 0.12], [ex - w * 0.03, ey - h * 0.06]], "#F59E0B");
  disc(ex, ey, h * 0.07, rgb("#FDE68A"));
  disc(ex - w * 0.1, ey - h * 0.14, h * 0.09, rgb("#64748B"));
  disc(ex + w * 0.1, ey - h * 0.18, h * 0.07, rgb("#94A3B8"));
}
function sceneStorm(x: number, y: number, w: number, h: number): void {
  // Nor'easter: storm cloud, driving rain, grounded parade balloon.
  fillRect(x, y, w, h, "#334155");
  polygon([[x + w * 0.06, y + h * 0.30], [x + w * 0.16, y + h * 0.12], [x + w * 0.34, y + h * 0.10], [x + w * 0.46, y + h * 0.24], [x + w * 0.42, y + h * 0.36], [x + w * 0.08, y + h * 0.36]], "#1E293B");
  polygon([[x + w * 0.48, y + h * 0.26], [x + w * 0.60, y + h * 0.10], [x + w * 0.78, y + h * 0.10], [x + w * 0.90, y + h * 0.24], [x + w * 0.86, y + h * 0.34], [x + w * 0.50, y + h * 0.34]], "#475569");
  for (let i = 0; i < 9; i++) {
    const rx = x + w * (0.05 + i * 0.11);
    line(rx, y + h * 0.40, rx - w * 0.03, y + h * 0.58, "#93C5FD", 2);
  }
  // grounded parade balloon: big red envelope, small highlight, ropes
  disc(x + w * 0.5, y + h * 0.72, h * 0.16, rgb("#C1272D"));
  disc(x + w * 0.45, y + h * 0.66, h * 0.05, rgb("#E8A0A0"));
  line(x + w * 0.42, y + h * 0.84, x + w * 0.40, y + h * 0.94, "#F6F1E3", 2);
  line(x + w * 0.58, y + h * 0.84, x + w * 0.60, y + h * 0.94, "#F6F1E3", 2);
  fillRect(x, y + h * 0.94, w, h * 0.06, "#1E293B");
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
    case "tube": // train front
      fillRect(x + 5 * u, y + 4 * u, 20 * u, 20 * u, "#C1272D");
      fillRect(x + 8 * u, y + 7 * u, 14 * u, 8 * u, "#F6F1E3");
      fillRect(x + 8 * u, y + 18 * u, 4 * u, 3 * u, "#F59E0B");
      fillRect(x + 18 * u, y + 18 * u, 4 * u, 3 * u, "#F59E0B");
      break;
    case "clinic": // tent + cross
      polygon([[x + 15 * u, y + 3 * u], [x + 27 * u, y + 24 * u], [x + 3 * u, y + 24 * u]], "#F6F1E3");
      line(x + 15 * u, y + 8 * u, x + 15 * u, y + 20 * u, "#C1272D", 3);
      line(x + 9 * u, y + 14 * u, x + 21 * u, y + 14 * u, "#C1272D", 3);
      break;
    case "tanker": // fuel truck + flame
      fillRect(x + 3 * u, y + 14 * u, 16 * u, 9 * u, "#94A3B8");
      fillRect(x + 19 * u, y + 16 * u, 8 * u, 7 * u, "#C1272D");
      disc(x + 8 * u, y + 25 * u, 3 * u, rgb("#141414")); disc(x + 22 * u, y + 25 * u, 3 * u, rgb("#141414"));
      polygon([[x + 12 * u, y + 2 * u], [x + 17 * u, y + 9 * u], [x + 15 * u, y + 13 * u], [x + 9 * u, y + 13 * u], [x + 8 * u, y + 8 * u]], "#EA580C");
      break;
    case "tower": // high-rise + flames
      fillRect(x + 8 * u, y + 4 * u, 14 * u, 24 * u, "#64748B");
      fillRect(x + 11 * u, y + 8 * u, 3 * u, 3 * u, "#FDE68A");
      fillRect(x + 16 * u, y + 8 * u, 3 * u, 3 * u, "#FDE68A");
      fillRect(x + 11 * u, y + 14 * u, 3 * u, 3 * u, "#FDE68A");
      fillRect(x + 16 * u, y + 14 * u, 3 * u, 3 * u, "#FDE68A");
      polygon([[x + 15 * u, y + 0 * u], [x + 20 * u, y + 6 * u], [x + 10 * u, y + 6 * u]], "#EA580C");
      break;
    case "court": // courthouse columns
      polygon([[x + 3 * u, y + 8 * u], [x + 15 * u, y + 2 * u], [x + 27 * u, y + 8 * u]], "#7C2D12");
      fillRect(x + 6 * u, y + 11 * u, 3 * u, 13 * u, "#F6F1E3");
      fillRect(x + 13 * u, y + 11 * u, 3 * u, 13 * u, "#F6F1E3");
      fillRect(x + 21 * u, y + 11 * u, 3 * u, 13 * u, "#F6F1E3");
      fillRect(x + 4 * u, y + 25 * u, 22 * u, 3 * u, "#7C2D12");
      break;
    case "refinery": // factory + chimney smoke + flame
      fillRect(x + 4 * u, y + 14 * u, 22 * u, 13 * u, "#334155");
      polygon([[x + 4 * u, y + 14 * u], [x + 10 * u, y + 8 * u], [x + 16 * u, y + 14 * u]], "#334155");
      fillRect(x + 20 * u, y + 4 * u, 4 * u, 12 * u, "#475569");
      disc(x + 22 * u, y + 2 * u, 3 * u, rgb("#94A3B8"));
      polygon([[x + 12 * u, y + 6 * u], [x + 16 * u, y + 11 * u], [x + 8 * u, y + 11 * u]], "#F59E0B");
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
    [0.15, 0.34, "NEW YORK", 1], [0.44, 0.16, "LONDON", 1], [0.60, 0.36, "KUWAIT", -1],
    [0.74, 0.26, "SEOUL", 1], [0.63, 0.48, "DELHI", -1], [0.78, 0.42, "BANGKOK", 1],
    [0.51, 0.62, "KINSHASA", 1], [0.28, 0.70, "SANTIAGO", 1], [0.87, 0.74, "CANBERRA", -1],
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
type Story = { n: string; title: string; deck: string; why: string; tag: string; icon: string; bg: string; src: string };
const HEROES: { title: string; deck: string; why: string; tag: string; scene: string; src: string }[] = [
  { title: "Drones kill 2 Italians in Kuwait", deck: "Drones hit a defence site, killing 2 techs. Iran blamed, denies.", why: "WHY: Gulf tensions spike.", tag: "MID EAST · DRONE STRIKE · CONFIRMED", scene: "drone", src: "Reuters" },
  { title: "EU summit fails; De Cos picked", deck: "No EUR1.78tn deal in 14 hours; De Cos picked for ECB.", why: "WHY: Retry 17 Dec; Lagarde leaves 7 Feb.", tag: "EUROPE · SUMMIT · OFFICIAL", scene: "parliament", src: "Consilium" },
  { title: "Storm hits Thanksgiving", deck: "Nearly 1M lose power; 820+ flights cut; gusts to 70 mph.", why: "WHY: Macy's 100th parade moves to Sat.", tag: "N AMERICA · WEATHER · CONFIRMED", scene: "storm", src: "NWS" },
];
const CARDS: Story[] = [
  { n: "4", title: "Korea raises rates", deck: "Base rate up 25bp to 3.25%, vote 5-2.", why: "WHY: Growth outlook raised.", tag: "E ASIA · CONFIRMED", icon: "rate", bg: "#FFEDD5", src: "Bank of Korea" },
  { n: "5", title: "Tube strike at noon", deck: "24-hour walkout; no Circle/Piccadilly.", why: "WHY: Four-day week row.", tag: "EUROPE · CONFIRMED", icon: "tube", bg: "#FEE2E2", src: "TfL / RMT" },
  { n: "6", title: "Flinders Island fire", deck: "6 properties hit; 14,000 ha, a tenth of island.", why: "WHY: 'Too late to leave'.", tag: "OCEANIA · REPORTED", icon: "fire", bg: "#FFEDD5", src: "AAP" },
  { n: "7", title: "Constitution Day", deck: "India marks 77 years since 1949 adoption.", why: "WHY: Ambedkar honoured.", tag: "S ASIA · CONFIRMED", icon: "book", bg: "#FFEDD5", src: "Govt of India" },
  { n: "8", title: "PBS freeze passes", deck: "Senate passes script-price freeze to 2030.", why: "WHY: Prices frozen to 2030.", tag: "OCEANIA · CONFIRMED", icon: "doc", bg: "#D1FAE5", src: "Senate" },
  { n: "9", title: "Channel boat dealer exposed", deck: "BBC: firm linked to a third of crossings.", why: "WHY: Supply line named.", tag: "EUROPE · REPORTED", icon: "wave", bg: "#FEF3C7", src: "BBC" },
  { n: "10", title: "Ebola tops 12,000", deck: "12,021 cases, 5,904 dead; 2nd-largest ever.", why: "WHY: Fighting blocks aid.", tag: "AFRICA · OFFICIAL", icon: "clinic", bg: "#FEE2E2", src: "Reuters" },
  { n: "11", title: "Giza driver held", deck: "Prosecutors hold driver, 21; admits 110 km/h.", why: "WHY: 31 dead, 26 hurt.", tag: "AFRICA · REPORTED", icon: "tanker", bg: "#FFEDD5", src: "Al Jazeera" },
  { n: "12", title: "Tai Po: 168 mourned", deck: "A year since the Wang Fuk Court fire.", why: "WHY: Deadliest in decades.", tag: "E ASIA · CONFIRMED", icon: "tower", bg: "#E0E7FF", src: "AP" },
  { n: "13", title: "Kenya court halts Ebola site", deck: "Court: US-backed site breached constitution.", why: "WHY: Deal must be shown.", tag: "AFRICA · CONFIRMED", icon: "court", bg: "#DBEAFE", src: "Reuters" },
  { n: "14", title: "Bangkok refinery blast", deck: "Blast, about 3pm; 9 hurt, units shut.", why: "WHY: 3 in critical condition.", tag: "SE ASIA · REPORTED", icon: "refinery", bg: "#FEF3C7", src: "AP" },
  { n: "15", title: "Chess: Game 3 today", deck: "1-1; Sindarov White, 15:00 CET.", why: "WHY: Title race level.", tag: "EUROPE · SCHEDULE", icon: "chess", bg: "#F3E8FF", src: "FIDE" },
];
const ALSO: [string, string, string][] = [
  ["16", "Blyth fronts media with Hanson", "OCEANIA"],
  ["17", "Trusts tax passes Parliament", "OCEANIA"],
  ["18", "3m women hurt by others' drinking", "OCEANIA"],
  ["19", "Davis Cup quarters in Bologna", "EUROPE"],
  ["20", "UK seasons shift: fewer frosts", "EUROPE"],
  ["21", "Congress marks Constitution Day", "S ASIA"],
  ["22", "Nawrocki lectures in Santiago", "S AMERICA"],
  ["23", "Copa flies Panama-Margarita", "S AMERICA"],
  ["24", "Mumbai marks 26/11 anniversary", "S ASIA"],
  ["25", "Health NZ rehires 166 it cut", "OCEANIA"],
  ["26", "2035 target slips away", "OCEANIA"],
  ["27", "Oil nears $95 on Hormuz fears", "MID EAST"],
  ["28", "King tides flood California", "N AMERICA"],
  ["29", "UK-EU treaties published", "EUROPE"],
  ["30", "Asia markets rebound", "E ASIA"],
  ["31", "Homes v data centres revolt", "E ASIA"],
];

// ---- build the page ----
function build(): void {
  fillRect(0, 0, W, H, "#F6F1E3");
  // Masthead
  fillRect(0, 0, W, 86, "#14243E");
  drawText(18, 10, 14, "THE WORLD IN ONE PAGE", "#F59E0B");
  drawText(18, 28, 38, "Thursday 26 November 2026", "#F6F1E3");
  const right = "31 STORIES  ·  9 REGIONS";
  drawText(W - 18 - textWidth(right, 16), 12, 16, right, "#F6F1E3");
  drawText(W - 18 - textWidth("All of one day's news", 13), 34, 13, "All of one day's news", "#BFD9E8");
  drawText(W - 18 - textWidth("Happened or first reported today", 13), 52, 13, "Happened or first reported today", "#BFD9E8");
  // Numbers strip
  fillRect(0, 86, W, 30, "#C1272D");
  drawTextC(W / 2, 95, 14, "12,021 Ebola cases  ·  2 dead in Kuwait  ·  EUR1.78tn no deal  ·  3.25% Korea  ·  1M lose power  ·  9 hurt in Bangkok", "#F6F1E3", W);
  // Heroes
  const hw = 328, hx = [16, 348, 680];
  HEROES.forEach((hs, i) => {
    const x = hx[i], y = 124, hh = 248;
    fillRect(x, y, hw, hh, "#FFFFFF");
    rectStroke(x, y, hw, hh, "#141414", 2);
    if (hs.scene === "parliament") sceneParliament(x + 10, y + 8, hw - 20, 118);
    else if (hs.scene === "drone") sceneDrone(x + 10, y + 8, hw - 20, 118);
    else sceneStorm(x + 10, y + 8, hw - 20, 118);
    const tlines = wrapLines(hs.title, 22, hw - 20).slice(0, 2);
    tlines.forEach((ln, k) => drawText(x + 10, y + 130 + k * 25, 22, ln, "#141414"));
    drawPara(x + 10, y + 184, 13, hs.deck, "#333333", hw - 20, 16);
    drawText(x + 10, y + 218, 12, hs.why, "#8A1A1A");
    fillRect(x + 10, y + 232, hw - 20, 1, "#999999");
    drawText(x + 10, y + 236, 10, hs.tag + "  ·  " + hs.src, "#666666");
  });
  // Cards: 4 columns x 3 rows
  const cw = 242, ch = 104, cgx = 8, cgy = 8;
  CARDS.forEach((cd, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 16 + col * (cw + cgx), y = 380 + row * (ch + cgy);
    fillRect(x, y, cw, ch, "#FFFFFF");
    rectStroke(x, y, cw, ch, "#141414", 1);
    iconBox(x + 8, y + 8, 34, cd.bg);
    drawIcon(cd.icon, x + 8, y + 8, 34);
    const ct = wrapLines(cd.n + ". " + cd.title, 14, cw - 56).slice(0, 2);
    ct.forEach((ln, k) => drawText(x + 48, y + 5 + k * 16, 14, ln, "#141414"));
    drawPara(x + 48, y + 40, 10, cd.deck, "#333333", cw - 56, 12);
    drawText(x + 48, y + 68, 10, cd.why, "#8A1A1A");
    drawText(x + 48, y + ch - 11, 9, cd.tag + " · " + cd.src, "#666666");
  });
  // Map + timeline band
  const my = 716, mh = 88;
  drawMap(16, my, 496, mh);
  fillRect(520, my, 488, mh, "#14243E");
  rectStroke(520, my, 488, mh, "#141414", 1);
  drawText(534, my + 7, 12, "THE DAY IN LOCAL TIMES", "#F59E0B");
  const tl: [string, string][] = [
    ["Morning", "Seoul: rates to 3.25%"],
    ["Morning", "Kinshasa: Ebola passes 12,000"],
    ["12:00", "London: Tube walkout"],
    ["14:00", "Kuwait: drones hit defence site"],
    ["14:45", "Bangkok: refinery blast"],
    ["Midnight", "Brussels: summit ends, no deal"],
  ];
  tl.forEach(([t, s], i) => {
    const yy = my + 24 + i * 10;
    drawText(534, yy, 10, t, "#F59E0B");
    drawText(606, yy, 10, s, "#F6F1E3");
  });
  // Also on: 2 columns x 8 rows
  const ay = 812;
  drawText(16, ay, 18, "ALSO ON 26 NOVEMBER", "#141414");
  fillRect(16, ay + 24, W - 32, 2, "#C1272D");
  const colW = 496, rowH = 19;
  ALSO.forEach(([n, t, region], i) => {
    const col = Math.floor(i / 8), row = i % 8;
    const x = 16 + col * colW, y = ay + 30 + row * rowH;
    drawText(x, y + 2, 12, n + ".", "#C1272D");
    drawText(x + 28, y + 2, 12, t, "#141414");
    drawText(x + colW - 84, y + 3, 10, region, "#666666");
  });
  // Date check footer
  const fy = 996;
  fillRect(0, fy, W, H - fy, "#14243E");
  drawText(16, fy + 3, 11, "DATE CHECK — Africa: Ebola 12,021 (Reuters, DRC data, Thu). Left out, 25 Nov: Cairo fire, tariffs,", "#F6F1E3");
  drawText(16, fy + 14, 11, "Solomon treaty, Ramaphosa, Savasleyka, Champions League, Hera, Netanyahu, SpaceX, FedEx. Macy's move decided Wed.", "#F59E0B");
}

function main(): void {
  build();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}
main();
