// Generates monochrome template PNGs for the menu-bar icon, one per phase:
//   focus.png (target), break.png (coffee), longbreak.png (moon).
// Black pixels + alpha => macOS template images (auto light/dark tinted).
// Run: npm run gen-tray-icons  (outputs to src-tauri/icons/)

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 44;
const SS = 4;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const c = SIZE / 2;

// Focus: a target (two rings + center dot).
function focus(x, y) {
  const d = Math.hypot(x - c, y - c);
  return Math.abs(d - 16) <= 2 || Math.abs(d - 9) <= 1.8 || d <= 3.6;
}

// Break: a coffee mug (tapered body + handle + two steam wisps).
function brk(x, y) {
  // body: trapezoid from y 16 (wider) to y 31 (narrower)
  if (y >= 16 && y <= 31) {
    const f = (y - 16) / (31 - 16);
    const left = 11 + f * 2.5;
    const right = 27 - f * 2.5;
    if (x >= left && x <= right) return true;
  }
  // handle: C on the right
  if (x >= 26 && Math.abs(Math.hypot(x - 27, y - 22.5) - 5) <= 1.7) return true;
  // steam
  if (segDist(x, y, 16, 9, 16, 13.5) <= 1.1) return true;
  if (segDist(x, y, 22, 8.5, 22, 13.5) <= 1.1) return true;
  return false;
}

// Long break: a crescent moon (circle minus offset circle).
function moon(x, y) {
  const big = Math.hypot(x - 20, y - 22) <= 14;
  const cut = Math.hypot(x - 26.5, y - 18) <= 13;
  return big && !cut;
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

function render(name, inside) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hit++;
        }
      }
      const o = y * (SIZE * 4 + 1) + 1 + x * 4;
      raw[o + 3] = Math.round((hit / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const file = join(OUT_DIR, name);
  writeFileSync(file, png);
  console.log("wrote", file);
}

render("focus.png", focus);
render("break.png", brk);
render("longbreak.png", moon);
