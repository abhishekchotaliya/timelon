import React from "react";
import ReactDOM from "react-dom/client";

import { SettingsProvider } from "./lib/settings";
import { PopoverView } from "./views/PopoverView";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <PopoverView />
    </SettingsProvider>
  </React.StrictMode>,
);
