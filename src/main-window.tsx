import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { Clock } from "lucide-react";

import {
  onNavigate,
  onPhaseChange,
  onTick,
  setMenuBarStyle,
  setTrayImage,
  timerSnapshot,
} from "./lib/ipc";
import { SettingsProvider, useApplyTheme, useSettings } from "./lib/settings";
import { play } from "./lib/sounds";
import { mmss, renderTrayIcon } from "./lib/trayIcon";
import type { TimerSnapshot } from "./types";
import { TimerView } from "./views/TimerView";
import { SettingsView } from "./views/SettingsView";
import { cn } from "./lib/utils";
import "./styles.css";

// Play the alert on every phase change, from the always-mounted root, so it
// works on any tab and always uses the currently-selected sound (via ref).
function useAlertSound() {
  const { settings } = useSettings();
  const ref = useRef({ soundId: settings.soundId, volume: settings.volume });
  ref.current = { soundId: settings.soundId, volume: settings.volume };
  useEffect(() => {
    const un = onPhaseChange(() => play(ref.current.soundId, ref.current.volume));
    return () => {
      un.then((f) => f());
    };
  }, []);
}

// Drives the "solid" menu-bar style. The always-mounted root gets every tick
// (emitted while running + on any state change), renders a knockout-pill PNG,
// and pushes it to the tray. In "default" style Rust owns the native title/icon
// so we render nothing. Runs here (not in a tab) so it's live regardless of the
// open view and even while the window is hidden.
function useMenuBarTray() {
  const { settings, loaded } = useSettings();
  const style = settings.menuBarStyle;
  const scale = settings.menuBarScale;
  const styleRef = useRef(style);
  styleRef.current = style;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const snapRef = useRef<TimerSnapshot | null>(null);

  const push = (s: TimerSnapshot | null) => {
    if (!s) return;
    renderTrayIcon(s.phase, mmss(s.remainingSecs), scaleRef.current, styleRef.current)
      .then(setTrayImage)
      .catch(() => {});
  };

  useEffect(() => {
    timerSnapshot()
      .then((s) => {
        snapRef.current = s;
        push(s);
      })
      .catch(() => {});
    const un = onTick((s) => {
      snapRef.current = s;
      push(s);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Tell the tray which style to use, then render.
  useEffect(() => {
    if (!loaded) return;
    setMenuBarStyle(style);
    push(snapRef.current);
  }, [loaded, style]);

  // Re-render on size change only; debounced so dragging the slider doesn't
  // fire a canvas render + IPC on every step.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => push(snapRef.current), 80);
    return () => clearTimeout(t);
  }, [loaded, scale]);
}

// Stats pulls in Recharts (the bulk of the bundle); load it only when opened.
const StatsView = lazy(() =>
  import("./views/StatsView").then((m) => ({ default: m.StatsView })),
);

type Tab = "timer" | "stats" | "settings";

function App() {
  useApplyTheme();
  useAlertSound();
  useMenuBarTray();
  const [tab, setTab] = useState<Tab>("timer");

  // The tray menu can route us to a specific section.
  useEffect(() => {
    const un = onNavigate((t) => {
      if (t === "timer" || t === "stats" || t === "settings") setTab(t);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  const navItem = (id: Tab, label: string) => (
    <button
      className={cn(
        "rounded-xl px-3 py-2 text-left text-sm font-medium transition-all duration-200",
        tab === id
          ? "bg-primary text-primary-foreground shadow-md shadow-black/15"
          : "text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-background/35">
      <nav className="flex w-[168px] flex-col gap-1 border-r border-border bg-card p-3 backdrop-blur-2xl">
        <div className="flex items-center gap-2 px-2.5 pb-4 pt-1.5 text-lg font-bold tracking-tight text-foreground">
          <Clock className="h-5 w-5" strokeWidth={2.5} />
          Timelon
        </div>
        {navItem("timer", "Timer")}
        {navItem("stats", "Stats")}
        {navItem("settings", "Settings")}
      </nav>
      <main className="flex-1 overflow-y-auto overscroll-contain p-7">
        <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
          {tab === "timer" ? <TimerView /> : tab === "stats" ? <StatsView /> : <SettingsView />}
        </Suspense>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
