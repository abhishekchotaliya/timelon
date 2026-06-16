import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { onNavigate } from "./lib/ipc";
import { SettingsProvider, useApplyTheme } from "./lib/settings";
import { SettingsView } from "./views/SettingsView";
import { StatsView } from "./views/StatsView";
import { cn } from "./lib/utils";
import "./styles.css";

type Tab = "stats" | "settings";

function MainWindow() {
  useApplyTheme();
  const [tab, setTab] = useState<Tab>("stats");

  // The tray / popover can route us to a specific tab.
  useEffect(() => {
    const un = onNavigate((t) => {
      if (t === "stats" || t === "settings") setTab(t);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  const navClass = (active: boolean) =>
    cn(
      "rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
      active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
    );

  return (
    <div className="flex h-screen">
      <nav className="flex w-[180px] flex-col gap-1.5 border-r border-border bg-card p-3">
        <div className="px-2.5 pb-3.5 pt-1.5 text-lg font-bold text-primary">Timelon</div>
        <button className={navClass(tab === "stats")} onClick={() => setTab("stats")}>
          Stats
        </button>
        <button className={navClass(tab === "settings")} onClick={() => setTab("settings")}>
          Settings
        </button>
      </nav>
      <main className="flex-1 overflow-y-auto p-7">
        {tab === "stats" ? <StatsView /> : <SettingsView />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <MainWindow />
    </SettingsProvider>
  </React.StrictMode>,
);
