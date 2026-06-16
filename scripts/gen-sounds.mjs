// Generates ~5 short, distinct alert tones as 16-bit PCM WAV files.
// These are synthesized from scratch — original works, released CC0 (see ASSETS.md).
// Run: npm run gen-sounds  (outputs to public/sounds/)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

// --- synthesis helpers -----------------------------------------------------

// One note: sine (plus a soft 2nd harmonic) with an exponential decay envelope.
function note(samples, startSec, durSec, freq, gain = 0.6, decay = 6) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durSec * SAMPLE_RATE);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    const s =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
    samples[start + i] = (samples[start + i] ?? 0) + gain * env * s;
  }
}

function buildSamples(totalSec) {
  return new Float32Array(Math.ceil(totalSec * SAMPLE_RATE));
}

// Float32 (-1..1) -> 16-bit PCM mono WAV buffer.
function toWav(samples) {
  // Soft-clip to avoid wrap-around when notes overlap.
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let v = Math.tanh(samples[i]);
    v = Math.max(-1, Math.min(1, v));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(1, 22); // channels
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Note frequencies (equal temperament).
const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880.0, C6 = 1046.5;

// --- the 5 tones -----------------------------------------------------------

const tones = {
  // Gentle ascending arpeggio.
  chime() {
    const s = buildSamples(1.4);
    note(s, 0.0, 0.7, C5, 0.5, 5);
    note(s, 0.15, 0.7, E5, 0.5, 5);
    note(s, 0.3, 1.0, G5, 0.55, 4);
    return s;
  },
  // Single resonant bell with long tail.
  bell() {
    const s = buildSamples(1.8);
    note(s, 0.0, 1.8, A5, 0.7, 2.5);
    return s;
  },
  // Short, bright two-tone ping.
  ping() {
    const s = buildSamples(0.6);
    note(s, 0.0, 0.25, C6, 0.6, 12);
    note(s, 0.12, 0.4, G5, 0.5, 10);
    return s;
  },
  // Wood-like staccato triplet (fast decay).
  marimba() {
    const s = buildSamples(0.9);
    note(s, 0.0, 0.25, C5, 0.6, 16);
    note(s, 0.18, 0.25, E5, 0.6, 16);
    note(s, 0.36, 0.4, G5, 0.6, 14);
    return s;
  },
  // Three even pulses — an unobtrusive alert.
  pulse() {
    const s = buildSamples(1.0);
    note(s, 0.0, 0.18, E5, 0.55, 9);
    note(s, 0.3, 0.18, E5, 0.55, 9);
    note(s, 0.6, 0.3, E5, 0.55, 8);
    return s;
  },
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [id, fn] of Object.entries(tones)) {
  const file = join(OUT_DIR, `${id}.wav`);
  writeFileSync(file, toWav(fn()));
  console.log("wrote", file);
}
