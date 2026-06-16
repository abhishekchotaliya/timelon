import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Tauri expects a fixed dev server on port 1420.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  // Multi-page build: one bundle per Tauri window.
  build: {
    target: "es2021",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popover: resolve(__dirname, "popover.html"),
      },
    },
  },
});
