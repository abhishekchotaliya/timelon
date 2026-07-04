import { useEffect, useState } from "react";

import { Controls } from "../components/Controls";
import { TimerRing } from "../components/TimerRing";
import {
  onTick,
  setConfig,
  timerPause,
  timerReset,
  timerSkip,
  timerSnapshot,
  timerStart,
} from "../lib/ipc";
import { toTimerConfig, useSettings } from "../lib/settings";
import type { TimerSnapshot } from "../types";

export function TimerView() {
  const { settings, loaded } = useSettings();
  const [snap, setSnap] = useState<TimerSnapshot | null>(null);

  // Hydrate + subscribe to tick events (the alert sound is handled at the app
  // root so it plays on any tab). Ticks are emitted at phase boundaries too.
  useEffect(() => {
    timerSnapshot().then(setSnap).catch(() => {});
    const unticks = onTick(setSnap);
    return () => {
      unticks.then((f) => f());
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
