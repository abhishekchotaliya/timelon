// Generates a monochrome clock PNG for the macOS menu-bar / tray icon.
// Black pixels + alpha → used as a macOS "template" image, so the system tints
// it automatically (dark icon on a light menu bar, light icon on a dark one).
// Run: npm run gen-tray-icon  (outputs src-tauri/icons/tray.png)
// Minimal hand-rolled PNG encoder (RGBA, no deps), shared style with gen-icon.mjs.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 44; // covers a 22pt menu-bar icon at @2x
const SS = 4; // supersample factor for smooth (anti-aliased) edges
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons", "tray.png");

const c = SIZE / 2;
const R = 17; // clock face radius
const RING = 1.7; // ring half-thickness

// Distance from point (px,py) to segment (ax,ay)-(bx,by).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cxp = ax + t * dx;
  const cyp = ay + t * dy;
  return Math.hypot(px - cxp, py - cyp);
}

// Is a sub-sampled point inside the clock mark?
function inside(x, y) {
  const dist = Math.hypot(x - c, y - c);
  if (Math.abs(dist - R) <= RING) return true; // outer ring
  if (Math.hypot(x - c, y - c) <= 2.2) return true; // center hub
  // Minute hand: straight up. Hour hand: to 3 o'clock.
  if (segDist(x, y, c, c, c, c - 12) <= 1.1) return true;
  if (segDist(x, y, c, c, c + 8, c) <= 1.4) return true;
  return false;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let hits = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits++;
      }
    }
    const a = Math.round((hits / (SS * SS)) * 255);
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[o] = 0;
    raw[o + 1] = 0;
    raw[o + 2] = 0;
    raw[o + 3] = a;
  }
}

function crc32(buf) {
  let cc = ~0;
  for (let i = 0; i < buf.length; i++) {
    cc ^= buf[i];
    for (let k = 0; k < 8; k++) cc = (cc >>> 1) ^ (0xedb88320 & -(cc & 1));
  }
  return ~cc >>> 0;
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
ihdr[9] = 6; // color type RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log("wrote", OUT);
