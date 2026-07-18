// Renders the "solid" menu-bar style: a filled rounded pill with the phase
// icon and MM:SS knocked out of it (transparent holes). The PNG is a macOS
// template image — only its alpha matters, so the OS tints the pill to the
// menu-bar color and the holes read as the bar behind it. Bytes are pushed to
// Rust via the `set_tray_image` command.

import type { Phase } from "../types";

const H = 44; // image height in px (~22pt @2x, matching the static icons)
const PAD_X = 9; // horizontal padding inside the pill
const GAP = 7; // icon-to-text gap
const ICON = 22; // icon box size
const FONT = "600 25px ui-monospace, 'SF Mono', Menlo, monospace";
const PILL = "#000"; // opaque => tinted; color is ignored by template mode

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

// Punch the phase glyph out of the pill. `x` is the icon box's left edge.
function drawIcon(ctx: CanvasRenderingContext2D, phase: Phase, x: number, cy: number) {
  const s = ICON;
  const cx = x + s / 2;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";

  if (phase === "focus") {
    // Target: two rings + center dot.
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (phase === "short_break") {
    // Coffee: cup body + handle + two steam wisps.
    const bw = s * 0.6;
    const bh = s * 0.5;
    const bx = x + s * 0.08;
    const by = cy - bh * 0.35;
    roundRect(ctx, bx, by, bw, bh, 3);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(bx + bw, by + bh * 0.42, s * 0.15, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (const fx of [0.28, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(bx + bw * fx, by - 6);
      ctx.lineTo(bx + bw * fx, by - 1.5);
      ctx.stroke();
    }
  } else {
    // Crescent moon: punch a full disc, then restore an offset disc.
    ctx.beginPath();
    ctx.arc(cx - 1, cy, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = PILL;
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, cy - s * 0.08, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

export async function renderTrayIcon(phase: Phase, time: string): Promise<Uint8Array> {
  // Measure the time text so the pill hugs its width.
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("no 2d context");
  probe.font = FONT;
  const textW = Math.ceil(probe.measureText(time).width);
  const width = PAD_X + ICON + GAP + textW + PAD_X;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // Solid capsule.
  ctx.fillStyle = PILL;
  roundRect(ctx, 2, 2, width - 4, H - 4, (H - 4) / 2);
  ctx.fill();

  drawIcon(ctx, phase, PAD_X, H / 2);

  // Knock the time out of the pill.
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#fff";
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(time, PAD_X + ICON + GAP, H / 2 + 1);
  ctx.globalCompositeOperation = "source-over";

  return toPng(canvas);
}

export function mmss(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
