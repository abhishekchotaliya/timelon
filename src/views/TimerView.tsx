import { useEffect, useRef, useState } from "react";

import { Controls } from "../components/Controls";
import { TimerRing } from "../components/TimerRing";
import {
  onPhaseChange,
  onTick,
  setConfig,
  timerPause,
  timerReset,
  timerSkip,
  timerSnapshot,
  timerStart,
} from "../lib/ipc";
import { toTimerConfig, useSettings } from "../lib/settings";
import { play } from "../lib/sounds";
import type { TimerSnapshot } from "../types";

export function TimerView() {
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
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
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
    </div>
  );
}
