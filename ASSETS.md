# Asset attributions

## Alert sounds (`public/sounds/`)

All bundled tunes are **original works synthesized from scratch** by
`scripts/gen-sounds.mjs` (sine tones with decay envelopes). They contain no
third-party samples and are released into the public domain under
**[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)**.

| File          | Name    | Description                          |
|---------------|---------|--------------------------------------|
| `chime.wav`   | Chime   | Gentle ascending C–E–G arpeggio      |
| `bell.wav`    | Bell    | Single resonant tone, long tail      |
| `ping.wav`    | Ping    | Short, bright two-tone ping          |
| `marimba.wav` | Marimba | Wood-like staccato triplet           |
| `pulse.wav`   | Pulse   | Three even pulses, unobtrusive       |

To regenerate: `npm run gen-sounds`.

## App icon (`src-tauri/icons/`)

Generated from `scripts/gen-icon.mjs` (an original "tomato" mark) via the Tauri
CLI (`npm run tauri icon`). Original work, CC0.

> If you add new sounds or art, only use CC0 / public-domain sources and record
> the source + license here. Do not commit copyrighted or ripped audio.
