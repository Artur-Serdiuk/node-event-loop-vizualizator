/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "/node-event-loop-vizualizator/",
  plugins: [react()],
  test: {
    exclude: ["e2e/**", "node_modules/**"],
  }
});
