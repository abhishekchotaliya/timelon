// CSS-variable theming. `applyTheme` toggles the light/dark data-attribute and
// sets the accent custom property; "system" follows prefers-color-scheme.

export type ThemeMode = "light" | "dark" | "system";

export const ACCENTS: Record<string, string> = {
  tomato: "#e34f32",
  indigo: "#5b6cf0",
  forest: "#2f9e60",
};

export const DEFAULT_ACCENT = "tomato";

export function applyTheme(mode: ThemeMode, accent: string) {
  const root = document.documentElement;
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  root.style.setProperty("--accent", ACCENTS[accent] ?? ACCENTS[DEFAULT_ACCENT]);
}

export function watchSystemTheme(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
