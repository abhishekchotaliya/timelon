import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { onNavigate } from "./lib/ipc";
import { SettingsProvider, useApplyTheme } from "./lib/settings";
import { SettingsView } from "./views/SettingsView";
import { StatsView } from "./views/StatsView";
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

  return (
    <div className="main-window">
      <nav className="sidebar">
        <div className="brand">Timelon</div>
        <button className={tab === "stats" ? "nav active" : "nav"} onClick={() => setTab("stats")}>
          Stats
        </button>
        <button
          className={tab === "settings" ? "nav active" : "nav"}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </nav>
      <main className="content">{tab === "stats" ? <StatsView /> : <SettingsView />}</main>
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
