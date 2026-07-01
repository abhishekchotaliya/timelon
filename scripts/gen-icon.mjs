// Generates a 1024x1024 source PNG for the app icon: a black clock on a white
// rounded-square (squircle-ish) background. Feed it to the Tauri CLI:
//   node scripts/gen-icon.mjs && npm run tauri icon scripts/icon-src.png
// Minimal hand-rolled PNG encoder (RGBA, no deps).

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const SS = 3; // supersample for smooth edges
const OUT = join(dirname(fileURLToPath(import.meta.url)), "icon-src.png");

const margin = SIZE * 0.085; // padding around the rounded square
const hx = SIZE / 2 - margin;
const hy = SIZE / 2 - margin;
const corner = SIZE * 0.225; // corner radius
const cx = SIZE / 2;
const cy = SIZE / 2;

const clockR = SIZE * 0.3; // clock face radius
const ring = SIZE * 0.028; // ring / hand half-thickness

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Coverage (0..1) of the rounded-square background at a point.
function bgAt(x, y) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > hx || dy > hy) return false;
  const qx = dx - (hx - corner);
  const qy = dy - (hy - corner);
  if (qx > 0 && qy > 0) return Math.hypot(qx, qy) <= corner;
  return true;
}

// Coverage of the black clock mark at a point.
function clockAt(x, y) {
  const d = Math.hypot(x - cx, y - cy);
  if (Math.abs(d - clockR) <= ring) return true; // outer ring
  if (d <= ring * 1.4) return true; // hub
  if (segDist(x, y, cx, cy, cx, cy - clockR * 0.62) <= ring * 0.85) return true; // minute hand (up)
  if (segDist(x, y, cx, cy, cx + clockR * 0.42, cy) <= ring) return true; // hour hand (3 o'clock)
  return false;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let bg = 0;
    let ck = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS;
        const py = y + (sy + 0.5) / SS;
        if (bgAt(px, py)) bg++;
        if (clockAt(px, py)) ck++;
      }
    }
    const n = SS * SS;
    const bgA = bg / n;
    const ckA = ck / n;
    const lum = Math.round(255 * (1 - ckA)); // white bg -> black clock
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[o] = lum;
    raw[o + 1] = lum;
    raw[o + 2] = lum;
    raw[o + 3] = Math.round(bgA * 255);
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log("wrote", OUT);
