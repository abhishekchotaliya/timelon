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
  const rel = Math.min(0.015, durSec * 0.4);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let env = Math.exp(-decay * t);
    const rem = durSec - t;
    if (rem < rel) env *= rem / rel;
    const s =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
    samples[start + i] = (samples[start + i] ?? 0) + gain * env * s;
  }
}

// A richer voice: additive partials, linear attack + exponential decay, with
// optional detune and vibrato (Hz). Used for the longer, "modern" tones.
function osc(samples, startSec, durSec, freq, opts = {}) {
  const {
    gain = 0.4,
    attack = 0.01,
    decay = 3,
    detune = 0,
    vibratoHz = 0,
    vibratoDepth = 0,
    partials = [
      [1, 1],
      [2, 0.3],
      [3, 0.12],
    ],
  } = opts;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durSec * SAMPLE_RATE);
  const base = freq * (1 + detune);
  const rel = Math.min(0.015, durSec * 0.4); // release fade so the note ends at 0
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    let env = t < attack ? t / attack : Math.exp(-decay * (t - attack));
    const rem = durSec - t;
    if (rem < rel) env *= rem / rel;
    const vib = vibratoDepth ? Math.sin(2 * Math.PI * vibratoHz * t) * vibratoDepth : 0;
    let sm = 0;
    for (const [mult, amp] of partials) {
      sm += amp * Math.sin(2 * Math.PI * (base * mult + vib) * t);
    }
    samples[start + i] = (samples[start + i] ?? 0) + gain * env * sm;
  }
}

// White noise burst with exponential decay; `hp` applies a crude high-pass
// (first-difference) for hats/snares.
function noise(samples, startSec, durSec, opts = {}) {
  const { gain = 0.4, decay = 20, hp = false } = opts;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durSec * SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    let n = Math.random() * 2 - 1;
    if (hp) {
      const cur = n;
      n = (n - prev) * 0.7;
      prev = cur;
    }
    samples[start + i] = (samples[start + i] ?? 0) + gain * env * n;
  }
}

// Pitch-swept oscillator (phase-accumulated) — used for kick drums and slides.
function sweep(samples, startSec, durSec, f0, f1, opts = {}) {
  const { gain = 0.6, decay = 10, k = 30, partials = [[1, 1]] } = opts;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(durSec * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const f = f1 + (f0 - f1) * Math.exp(-k * t);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    let sm = 0;
    for (const [m, a] of partials) sm += a * Math.sin(phase * m);
    samples[start + i] = (samples[start + i] ?? 0) + gain * env * sm;
  }
}

function buildSamples(totalSec) {
  return new Float32Array(Math.ceil(totalSec * SAMPLE_RATE));
}

// Float32 (-1..1) -> 16-bit PCM mono WAV buffer.
function toWav(samples) {
  // Soft-clip to avoid wrap-around when notes overlap.
  const pcm = Buffer.alloc(samples.length * 2);
  const fade = Math.floor(0.04 * SAMPLE_RATE); // 40ms in/out fade — no clicks
  for (let i = 0; i < samples.length; i++) {
    let v = Math.tanh(samples[i]);
    if (i < fade) v *= i / fade;
    const tail = samples.length - 1 - i;
    if (tail < fade) v *= tail / fade;
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
const A4 = 440.0, C5 = 523.25, E5 = 659.25, F5 = 698.46, G5 = 783.99;
const A5 = 880.0, B5 = 987.77, C6 = 1046.5, D6 = 1174.66, E6 = 1318.51;
const G6 = 1567.98;

// Bright square-ish wave (odd harmonics) for chiptune / arcade tones.
const SQUARE = [[1, 1], [3, 0.33], [5, 0.2], [7, 0.14], [9, 0.11]];

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
  // Three even pulses — an unobtrusive alert.
  pulse() {
    const s = buildSamples(1.0);
    note(s, 0.0, 0.18, E5, 0.55, 9);
    note(s, 0.3, 0.18, E5, 0.55, 9);
    note(s, 0.6, 0.3, E5, 0.55, 8);
    return s;
  },

  // --- longer, modern tones (3-4s) ----------------------------------------

  // Warm pad chord that swells, with a shimmering arpeggio on top.
  aurora() {
    const s = buildSamples(3.8);
    osc(s, 0.0, 3.6, C5, { gain: 0.16, attack: 0.6, decay: 1.0, detune: 0.004, partials: [[1, 1], [2, 0.25]] });
    osc(s, 0.0, 3.6, E5, { gain: 0.14, attack: 0.7, decay: 1.0, detune: -0.004, partials: [[1, 1], [2, 0.2]] });
    osc(s, 0.0, 3.6, G5, { gain: 0.14, attack: 0.8, decay: 1.0, partials: [[1, 1], [2, 0.2]] });
    osc(s, 0.5, 1.4, C6, { gain: 0.15, attack: 0.005, decay: 3.5 });
    osc(s, 1.1, 1.4, E6, { gain: 0.13, attack: 0.005, decay: 3.5 });
    osc(s, 1.8, 1.8, G6, { gain: 0.13, attack: 0.005, decay: 3.0 });
    return s;
  },

  // Descending bell cascade with long tails.
  cascade() {
    const s = buildSamples(3.6);
    [C6, A5, G5, E5, C5].forEach((f, i) =>
      osc(s, i * 0.3, 2.4, f, { gain: 0.3, attack: 0.003, decay: 2.0, partials: [[1, 1], [2, 0.4], [3, 0.12]] }),
    );
    return s;
  },

  // Soft chord bloom that swells in, with a gentle top note at the peak.
  bloom() {
    const s = buildSamples(4.2);
    [C5, E5, G5, C6].forEach((f, i) =>
      osc(s, 0, 4.0, f, {
        gain: 0.13,
        attack: 0.9,
        decay: 0.75,
        detune: i % 2 ? 0.003 : -0.003,
        partials: [[1, 1], [2, 0.2], [3, 0.08]],
      }),
    );
    osc(s, 1.2, 2.0, G6, { gain: 0.11, attack: 0.01, decay: 2.2 });
    return s;
  },

  // Plucky kalimba-style arpeggio pattern (odd harmonics).
  kalimba() {
    const s = buildSamples(3.4);
    [C5, G5, E5, A5, G5, C6, G5, E5].forEach((f, i) =>
      osc(s, i * 0.32, 1.0, f, { gain: 0.32, attack: 0.002, decay: 6, partials: [[1, 1], [3, 0.25], [5, 0.08]] }),
    );
    return s;
  },

  // Singing bowl: inharmonic partials with slow beating, very long tail.
  bowl() {
    const s = buildSamples(6.0);
    osc(s, 0, 6.0, A4, {
      gain: 0.4,
      attack: 0.05,
      decay: 0.6,
      vibratoHz: 4,
      vibratoDepth: 1.5,
      partials: [[1, 1], [2.76, 0.4], [5.4, 0.15], [8.9, 0.05]],
    });
    osc(s, 0, 0.5, A5 * 2, { gain: 0.09, attack: 0.002, decay: 8 });
    return s;
  },

  // Arcade: upbeat original chiptune riff (square wave) with a bassline.
  arcade() {
    const s = buildSamples(7.0);
    const b = 0.15;
    const beep = (st, f) => osc(s, st, 0.13, f, { gain: 0.26, attack: 0.002, decay: 10, partials: SQUARE });
    const mel = [
      C5, E5, G5, C6, G5, E5,
      F5, A5, C6, A5, F5, A5,
      G5, B5, D6, B5, G5, B5,
      C6, E6, G6, E6, C6, G5,
    ];
    mel.forEach((f, i) => beep(i * b, f));
    const bass = [C5 / 2, F5 / 2, G5 / 2, C5 / 2];
    for (let i = 0; i < mel.length; i += 6) {
      osc(s, i * b, 0.32, bass[i / 6], { gain: 0.2, attack: 0.003, decay: 6, partials: SQUARE });
    }
    const end = mel.length * b + 0.05;
    [C5, E5, G5, C6].forEach((f) => osc(s, end, 1.4, f, { gain: 0.15, attack: 0.004, decay: 2.2, partials: SQUARE }));
    return s;
  },

  // Cartoon: playful slide-whistle + xylophone tumble + a "ta-da" (original).
  cartoon() {
    const s = buildSamples(7.0);
    const xylo = (st, f) => osc(s, st, 0.5, f, { gain: 0.3, attack: 0.002, decay: 9, partials: [[1, 1], [4, 0.3], [6, 0.1]] });
    [C6, B5, A5, G5, E5, C5].forEach((f, i) => xylo(i * 0.12, f));
    sweep(s, 0.9, 0.55, 380, 1150, { gain: 0.22, decay: 1.5, k: 6 });
    sweep(s, 1.5, 0.65, 1150, 300, { gain: 0.22, decay: 1.5, k: 5 });
    [G5, C6, G5, E5, G5, C6].forEach((f, i) =>
      osc(s, 2.3 + i * 0.18, 0.45, f, { gain: 0.24, attack: 0.002, decay: 10, partials: [[1, 1], [3, 0.3]] }),
    );
    [C6, E6, G6].forEach((f) => osc(s, 3.5, 1.5, f, { gain: 0.2, attack: 0.004, decay: 2.0, partials: [[1, 1], [2, 0.4], [3, 0.15]] }));
    return s;
  },

  // Clean, modern notification ding (SMS-like) with a soft shimmer tail.
  notify() {
    const s = buildSamples(2.8);
    osc(s, 0.0, 0.5, E6, { gain: 0.32, attack: 0.003, decay: 8, partials: [[1, 1], [2, 0.4]] });
    osc(s, 0.12, 0.6, G6, { gain: 0.3, attack: 0.003, decay: 7, partials: [[1, 1], [2, 0.4]] });
    osc(s, 0.24, 2.4, C6, { gain: 0.34, attack: 0.004, decay: 1.5, partials: [[1, 1], [2, 0.35], [3, 0.12]] });
    osc(s, 0.24, 2.4, C6 * 2, { gain: 0.07, attack: 0.01, decay: 1.7 });
    return s;
  },

  // Airy flute: soft-attack, vibrato, faint breath noise — a 3-note phrase.
  flute() {
    const s = buildSamples(3.8);
    const phrase = (st, du, f) => {
      osc(s, st, du, f, {
        gain: 0.3,
        attack: 0.09,
        decay: 0.5,
        vibratoHz: 5,
        vibratoDepth: 2.5,
        partials: [[1, 1], [2, 0.12], [3, 0.05]],
      });
      noise(s, st, du * 0.5, { gain: 0.014, decay: 3 });
    };
    phrase(0.0, 1.3, G5);
    phrase(1.0, 1.3, A5);
    phrase(2.0, 1.7, C6);
    return s;
  },

  // Techno: pulsing saw bass with a syncopated lead arpeggio.
  techno() {
    const s = buildSamples(3.8);
    const saw = [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2], [5, 0.13]];
    const roots = [110, 110, 164.81, 110]; // A2, A2, E3, A2
    const step = 0.2;
    for (let i = 0; i < 16; i++) {
      osc(s, i * step, step * 0.85, roots[i % 4], { gain: 0.24, attack: 0.004, decay: 8, partials: saw });
    }
    [C6, E6, G6, E6, C6, G6, E6, C6].forEach((f, i) =>
      osc(s, i * 0.4 + 0.1, 0.32, f, { gain: 0.13, attack: 0.003, decay: 9, partials: [[1, 1], [2, 0.45], [3, 0.15]] }),
    );
    return s;
  },

  // Drum groove: kick + snare + hats (4/4, ~100 bpm).
  drum() {
    const s = buildSamples(3.2);
    const kick = (t) => sweep(s, t, 0.35, 140, 48, { gain: 0.9, decay: 9, k: 35 });
    const snare = (t) => {
      noise(s, t, 0.22, { gain: 0.5, decay: 22, hp: true });
      osc(s, t, 0.18, 180, { gain: 0.22, attack: 0.001, decay: 20, partials: [[1, 1], [2, 0.5]] });
    };
    const hat = (t) => noise(s, t, 0.06, { gain: 0.2, decay: 60, hp: true });
    const beat = 0.6;
    for (let t = 0; t < 3.0; t += beat / 2) hat(t);
    [0, 1.2, 2.4].forEach(kick);
    [0.6, 1.8].forEach(snare);
    return s;
  },

  // Neon: bright saw-pluck arpeggio with echo — modern synth.
  neon() {
    const s = buildSamples(3.6);
    const pl = [[1, 1], [2, 0.5], [3, 0.28], [4, 0.16]];
    [C5, G5, C6, E6, G6, E6, C6, G5].forEach((f, i) => {
      osc(s, i * 0.22, 0.6, f, { gain: 0.25, attack: 0.002, decay: 7, partials: pl });
      osc(s, i * 0.22 + 0.33, 0.5, f, { gain: 0.11, attack: 0.002, decay: 8, partials: pl });
    });
    return s;
  },
};

// Trim trailing near-silence so a tone ends when it has naturally decayed
// (the 40ms fade in toWav then smooths the very end). Keeps a small tail pad.
function trimSilence(s, thr = 0.0006, padSec = 0.06) {
  let end = s.length;
  while (end > 1 && Math.abs(s[end - 1]) < thr) end--;
  end = Math.min(s.length, end + Math.floor(padSec * SAMPLE_RATE));
  return s.subarray(0, end);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [id, fn] of Object.entries(tones)) {
  const file = join(OUT_DIR, `${id}.wav`);
  writeFileSync(file, toWav(trimSilence(fn())));
  console.log("wrote", file);
}
