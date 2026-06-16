// Generates a 1024x1024 source PNG for the app icon (a simple "tomato" mark).
// Feed it to the Tauri CLI to produce all platform icons:
//   node scripts/gen-icon.mjs && npm run tauri icon scripts/icon-src.png
// Minimal hand-rolled PNG encoder (RGBA, no deps).

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "icon-src.png");

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
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Compose the pixel buffer (RGBA) with a filter byte per scanline.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
const cx = SIZE / 2;
const cy = SIZE * 0.56;
const r = SIZE * 0.40;

function set(row, x, [red, g, b, a]) {
  const o = row * (SIZE * 4 + 1) + 1 + x * 4;
  raw[o] = red; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
}

const TOMATO = [0xe3, 0x4f, 0x32, 255];
const TOMATO_HI = [0xf0, 0x6a, 0x4e, 255];
const LEAF = [0x4c, 0xaf, 0x50, 255];
const CLEAR = [0, 0, 0, 0];

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) {
      // Subtle radial highlight toward the upper-left.
      const hl = Math.max(0, 1 - Math.hypot(x - cx * 0.8, y - cy * 0.8) / (r * 1.1));
      const col = [
        Math.round(TOMATO[0] + (TOMATO_HI[0] - TOMATO[0]) * hl),
        Math.round(TOMATO[1] + (TOMATO_HI[1] - TOMATO[1]) * hl),
        Math.round(TOMATO[2] + (TOMATO_HI[2] - TOMATO[2]) * hl),
        255,
      ];
      set(y, x, col);
    } else {
      set(y, x, CLEAR);
    }
  }
}

// A small leaf/stem on top.
const leafCx = cx;
const leafCy = SIZE * 0.16;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = (x - leafCx) / (SIZE * 0.16);
    const dy = (y - leafCy) / (SIZE * 0.07);
    if (dx * dx + dy * dy <= 1) set(y, x, LEAF);
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
// 10,11,12 = compression/filter/interlace = 0

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log("wrote", OUT);
