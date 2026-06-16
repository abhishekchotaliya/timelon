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

import type { TimerConfig } from "../types";
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
  accent: string;
  soundId: string;
  volume: number;
};

export const DEFAULT_SETTINGS: Settings = {
  focusSecs: 25 * 60,
  shortBreakSecs: 5 * 60,
  longBreakSecs: 15 * 60,
  sessionsPerLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  launchAtLogin: false,
  theme: "system",
  accent: "tomato",
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

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void (async () => {
        const store = await getStore();
        await store.set(STORE_KEY, next);
        await store.save();
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

/// Apply the current theme + accent to the document, following system changes.
export function useApplyTheme() {
  const { settings } = useSettings();
  useEffect(() => {
    applyTheme(settings.theme, settings.accent);
    if (settings.theme === "system") {
      return watchSystemTheme(() => applyTheme(settings.theme, settings.accent));
    }
  }, [settings.theme, settings.accent]);
}
