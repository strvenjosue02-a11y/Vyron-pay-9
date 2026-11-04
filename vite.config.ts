import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // The Three.js/WebGPU chunk is large by nature; it is lazy-loaded, never on first paint.
    chunkSizeWarningLimit: 2000,
  },
});
