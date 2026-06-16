import { useEffect, useRef, useState } from "react";

import { Controls } from "../components/Controls";
import { TimerRing } from "../components/TimerRing";
import { Button } from "../components/ui/button";
import {
  onPhaseChange,
  onTick,
  openMain,
  setConfig,
  timerPause,
  timerReset,
  timerSkip,
  timerSnapshot,
  timerStart,
} from "../lib/ipc";
import { toTimerConfig, useApplyTheme, useSettings } from "../lib/settings";
import { play } from "../lib/sounds";
import type { TimerSnapshot } from "../types";

export function PopoverView() {
  useApplyTheme();
  const { settings, loaded } = useSettings();
  const [snap, setSnap] = useState<TimerSnapshot | null>(null);

  // Keep the latest sound prefs in a ref so the phase-change listener (set up
  // once) always plays with current settings.
  const soundRef = useRef({ soundId: settings.soundId, volume: settings.volume });
  soundRef.current = { soundId: settings.soundId, volume: settings.volume };

  // Hydrate + subscribe to engine events once.
  useEffect(() => {
    timerSnapshot().then(setSnap).catch(() => {});
    const unticks = onTick(setSnap);
    const unphase = onPhaseChange(() => {
      play(soundRef.current.soundId, soundRef.current.volume);
    });
    return () => {
      unticks.then((f) => f());
      unphase.then((f) => f());
    };
  }, []);

  // Push timer config to the engine whenever settings load/change.
  useEffect(() => {
    if (loaded) setConfig(toTimerConfig(settings)).then(setSnap).catch(() => {});
  }, [
    loaded,
    settings.focusSecs,
    settings.shortBreakSecs,
    settings.longBreakSecs,
    settings.sessionsPerLongBreak,
    settings.autoStartBreaks,
    settings.autoStartFocus,
  ]);

  if (!snap)
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-[18px] bg-background p-4">
      <TimerRing
        phase={snap.phase}
        remainingSecs={snap.remainingSecs}
        plannedSecs={snap.plannedSecs}
      />
      <Controls
        running={snap.running}
        onStart={() => timerStart().then(setSnap)}
        onPause={() => timerPause().then(setSnap)}
        onReset={() => timerReset().then(setSnap)}
        onSkip={() => timerSkip().then(setSnap)}
      />
      <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
        <Button variant="link" size="sm" onClick={() => openMain("stats")}>
          Stats
        </Button>
        <span>·</span>
        <Button variant="link" size="sm" onClick={() => openMain("settings")}>
          Settings
        </Button>
      </div>
    </div>
  );
}
