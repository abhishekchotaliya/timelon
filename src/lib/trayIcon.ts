// Renders the menu-bar time as a template PNG (both styles are drawn here so
// the settings preview can share the exact same layout + font):
//   • "default" — phase icon + MM:SS drawn as opaque ink (macOS tints it).
//   • "solid"   — a filled rounded pill with the icon + MM:SS knocked out.
// Only alpha matters for template images, so the OS tints the ink/pill to the
// menu-bar color and knockout holes read as the bar behind. Bytes go to Rust
// via `set_tray_image`.
//
// macOS scales the tray image to the menu-bar thickness, so on-screen height is
// fixed. To size the time we vary the digit cap height as a fraction of BAR_H;
// `scale` maps 0.5–2.0 onto that fraction (0.82·BAR_H fills the bar).

import type { MenuBarStyle } from "./settings";
import type { Phase } from "../types";

export const BAR_H = 44; // tray image height in px (~22pt @2x); maps to the menu-bar
const FONT_STACK = "ui-monospace, 'SF Mono', Menlo, monospace";

// Digit cap height (px) for a given size scale, at the tray's BAR_H. Saturates
// near a full-bar fill (0.82·BAR_H). Shared so the preview matches the tray.
export function capForScale(scale: number): number {
  return BAR_H * Math.min(0.45 * scale, 0.82);
}
const CAP_RATIO = 0.72; // cap height ≈ 0.72·font for this stack

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

type Mode = "ink" | "cut"; // draw positive ink, or knock out of the pill

// Draw the phase glyph. In "cut" mode it removes pill alpha (holes); in "ink"
// mode it paints the shape in `ink`.
function drawGlyph(
  ctx: CanvasRenderingContext2D,
  phase: Phase,
  x: number,
  cy: number,
  s: number,
  mode: Mode,
  ink: string,
  pill: string,
) {
  const cx = x + s / 2;
  ctx.save();
  ctx.lineJoin = "round";
  const paint = mode === "cut" ? "#fff" : ink;
  const setCut = () => {
    ctx.globalCompositeOperation = mode === "cut" ? "destination-out" : "source-over";
    ctx.fillStyle = paint;
    ctx.strokeStyle = paint;
  };
  setCut();

  if (phase === "focus") {
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (phase === "short_break") {
    const bw = s * 0.6;
    const bh = s * 0.5;
    const bx = x + s * 0.08;
    const by = cy - bh * 0.35;
    roundRect(ctx, bx, by, bw, bh, s * 0.13);
    ctx.fill();
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.arc(bx + bw, by + bh * 0.42, s * 0.15, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.lineWidth = s * 0.09;
    for (const fx of [0.28, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(bx + bw * fx, by - s * 0.27);
      ctx.lineTo(bx + bw * fx, by - s * 0.07);
      ctx.stroke();
    }
  } else {
    // Crescent: a disc minus an offset disc. Order depends on the mode so the
    // crescent lands in ink (default) or as a pill hole (solid).
    if (mode === "cut") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx - s * 0.04, cy, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = pill;
      ctx.beginPath();
      ctx.arc(cx + s * 0.18, cy - s * 0.08, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx - s * 0.04, cy, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx + s * 0.18, cy - s * 0.08, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export type TrayOpts = {
  phase: Phase;
  time: string;
  style: MenuBarStyle;
  capPx: number; // digit cap height in px
  ink: string; // "#000" for the template PNG; a theme color for previews
  canvasH?: number; // fixed height (tray = BAR_H); omit to fit content (preview)
};

// Draw the menu-bar content into `canvas`, sizing it to fit. Shared by the tray
// PNG path and the settings preview so both use the identical font + layout.
export function drawTrayTo(canvas: HTMLCanvasElement, opts: TrayOpts): void {
  const { phase, time, style, capPx, ink, canvasH } = opts;
  const filled = style === "solid";
  const fontPx = capPx / CAP_RATIO;
  const font = `600 ${fontPx.toFixed(1)}px ${FONT_STACK}`;

  let iconS = capPx * 1.15;
  const H = canvasH ?? Math.ceil(iconS * 1.25 + 2);
  if (canvasH) iconS = Math.min(iconS, canvasH * 0.92);
  const padX = fontPx * 0.32;
  const gap = fontPx * 0.26;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(time).width);
  const W = Math.ceil(padX + iconS + gap + textW + padX);

  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  const cy = H / 2;

  if (filled) {
    const pillH = Math.min(H, Math.max(iconS, capPx) * 1.25);
    ctx.fillStyle = ink;
    roundRect(ctx, 0, (H - pillH) / 2, W, pillH, pillH / 2);
    ctx.fill();
  }

  drawGlyph(ctx, phase, padX, cy, iconS, filled ? "cut" : "ink", ink, ink);

  if (filled) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#fff";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = ink;
  }
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(time, padX + iconS + gap, cy + 1);
  ctx.globalCompositeOperation = "source-over";
}

function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob failed"));
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject);
    }, "image/png");
  });
}

export async function renderTrayIcon(
  phase: Phase,
  time: string,
  scale: number,
  style: MenuBarStyle,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  drawTrayTo(canvas, { phase, time, style, capPx: capForScale(scale), ink: "#000", canvasH: BAR_H });
  return toPng(canvas);
}

export function mmss(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
