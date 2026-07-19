// Phase color schemes for the stats/graphs (focus / break / long break).
// Applied as CSS vars --focus, --break, --long-break; the app chrome stays
// monochrome. "mono" derives shades from the brand color.

export type ColorScheme = "classic" | "pastel" | "mono" | "fun" | "radient" | "flat";

type Scheme = { label: string; focus: string; break: string; longBreak: string };

export const COLOR_SCHEMES: Record<ColorScheme, Scheme> = {
  classic: { label: "Classic", focus: "#2f9e44", break: "#f2b705", longBreak: "#e8590c" },
  pastel: { label: "Pastel", focus: "#786fa6", break: "#f78fb3", longBreak: "#f5cd79" },
  mono: { label: "Mono", focus: "", break: "", longBreak: "" }, // brand-derived
  fun: { label: "Fun", focus: "#06b6d4", break: "#a855f7", longBreak: "#f43f5e" },
  radient: { label: "Radient", focus: "#3ae374", break: "#7d5fff", longBreak: "#ff9f1a" },
  flat: { label: "Flat", focus: "#1abc9c", break: "#f1c40f", longBreak: "#e67e22" },
};

const MONO = {
  focus: "var(--brand)",
  break: "color-mix(in srgb, var(--brand) 55%, var(--muted-foreground))",
  longBreak: "color-mix(in srgb, var(--brand) 22%, var(--muted-foreground))",
};

export function applyColorScheme(scheme: ColorScheme) {
  const root = document.documentElement;
  const c = scheme === "mono" ? MONO : (COLOR_SCHEMES[scheme] ?? COLOR_SCHEMES.classic);
  root.style.setProperty("--focus", c.focus);
  root.style.setProperty("--break", c.break);
  root.style.setProperty("--long-break", c.longBreak);
}
