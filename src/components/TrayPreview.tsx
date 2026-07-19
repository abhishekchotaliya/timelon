import { useEffect, useRef } from "react";

import { useSettings, type MenuBarStyle } from "../lib/settings";
import { BAR_H, capForScale, drawTrayTo } from "../lib/trayIcon";

const K = 2; // render 2× for retina crispness; CSS scales back down

// Thumbnail of how the menu bar renders for a given style, drawn with the exact
// same layout/font as the real tray so the preview matches. Uses the theme
// foreground as ink and redraws when the theme flips.
export function TrayPreview({ style }: { style: MenuBarStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ink =
      getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() ||
      "#000";
    // Fixed height (like the real menu bar) with a scale-driven cap height, so
    // the slider visibly grows/shrinks the digits. Rendered 2× for crispness.
    drawTrayTo(canvas, {
      phase: "focus",
      time: "12:34",
      style,
      capPx: capForScale(settings.menuBarScale) * K,
      ink,
      canvasH: BAR_H * K,
    });
  }, [style, settings.theme, settings.menuBarScale]);

  return <canvas ref={ref} className="h-[26px] w-auto" aria-hidden />;
}
