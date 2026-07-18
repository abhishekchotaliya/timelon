// Settings persisted via tauri-plugin-store, exposed through a React context.
// The engine receives the timer-relevant subset via set_config.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { emit, listen } from "@tauri-apps/api/event";

import type { TimerConfig } from "../types";
import { setWindowTheme } from "./ipc";
import { applyColorScheme, type ColorScheme } from "./colors";
import { applyTheme, watchSystemTheme, type ThemeMode } from "./theme";

export type Settings = {
  focusSecs: number;
  shortBreakSecs: number;
  longBreakSecs: number;
  sessionsPerLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  launchAtLogin: boolean;
  theme: ThemeMode;
  colorScheme: ColorScheme;
  menuBarStyle: MenuBarStyle;
  soundId: string;
  volume: number;
};

// Menu-bar rendering: "default" (native template icon + text) or "solid" (a
// knockout pill image). Persisted here; the tray is told via set_menu_bar_style.
export type MenuBarStyle = "default" | "solid";

export const DEFAULT_SETTINGS: Settings = {
  focusSecs: 25 * 60,
  shortBreakSecs: 5 * 60,
  longBreakSecs: 15 * 60,
  sessionsPerLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  launchAtLogin: false,
  theme: "system",
  colorScheme: "classic",
  menuBarStyle: "default",
  soundId: "chime",
  volume: 0.7,
};

export function toTimerConfig(s: Settings): TimerConfig {
  return {
    focusSecs: s.focusSecs,
    shortBreakSecs: s.shortBreakSecs,
    longBreakSecs: s.longBreakSecs,
    sessionsPerLongBreak: s.sessionsPerLongBreak,
    autoStartBreaks: s.autoStartBreaks,
    autoStartFocus: s.autoStartFocus,
  };
}

const STORE_KEY = "settings";
// Broadcast so every window (popover + main) stays in sync, since each holds
// its own React copy of the settings.
const SETTINGS_EVENT = "settings-changed";

let storePromise: Promise<Store> | null = null;
function getStore() {
  if (!storePromise) storePromise = load("settings.json");
  return storePromise;
}

type Ctx = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = await getStore();
        const saved = await store.get<Partial<Settings>>(STORE_KEY);
        if (active) setSettings({ ...DEFAULT_SETTINGS, ...(saved ?? {}) });
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Stay in sync with changes made in other windows.
  useEffect(() => {
    const un = listen<Settings>(SETTINGS_EVENT, (e) => setSettings(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void (async () => {
        const store = await getStore();
        await store.set(STORE_KEY, next);
        await store.save();
        // Notify the other windows (and ourselves; harmless) of the new state.
        await emit(SETTINGS_EVENT, next);
      })();
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, loaded, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

/// Apply the current theme to the document, following system changes.
export function useApplyTheme() {
  const { settings } = useSettings();
  useEffect(() => {
    applyTheme(settings.theme);
    applyColorScheme(settings.colorScheme);
    // Keep the native window (vibrancy) appearance in sync so the blur material
    // matches the theme — otherwise light-theme text sits on a dark blur.
    setWindowTheme(settings.theme);
    if (settings.theme === "system") {
      return watchSystemTheme(() => applyTheme(settings.theme));
    }
  }, [settings.theme, settings.colorScheme]);
}
