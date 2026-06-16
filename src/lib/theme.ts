// CSS-variable theming. `applyTheme` toggles the light/dark data-attribute;
// "system" follows prefers-color-scheme. Colors (incl. the monochrome --brand)
// live entirely in styles.css per theme.

export type ThemeMode = "light" | "dark" | "system";

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

export function watchSystemTheme(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
