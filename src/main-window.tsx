import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Clock } from "lucide-react";

import { onNavigate } from "./lib/ipc";
import { SettingsProvider, useApplyTheme } from "./lib/settings";
import { TimerView } from "./views/TimerView";
import { SettingsView } from "./views/SettingsView";
import { cn } from "./lib/utils";
import "./styles.css";

// Stats pulls in Recharts (the bulk of the bundle); load it only when opened.
const StatsView = lazy(() =>
  import("./views/StatsView").then((m) => ({ default: m.StatsView })),
);

type Tab = "timer" | "stats" | "settings";

function App() {
  useApplyTheme();
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
        "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen">
      <nav className="flex w-[170px] flex-col gap-1.5 border-r border-border bg-card p-3">
        <div className="flex items-center gap-2 px-2.5 pb-3.5 pt-1.5 text-lg font-bold text-foreground">
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
