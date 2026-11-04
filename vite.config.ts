import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  // `vite build --mode artifact` → one self-contained HTML (scripts, CSS,
  // fonts, HDRI inlined) for hosts that block external files and fetch().
  const single = mode === "artifact";
  return {
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        // Preact con la API de React: ~10 KB en vez de ~60 KB de react-dom (Android de gama media).
        react: "preact/compat",
        "react-dom/client": "preact/compat/client",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
        "react/jsx-dev-runtime": "preact/jsx-dev-runtime",
      },
    },
    build: {
      outDir: single ? "dist-artifact" : "dist",
      // The Three.js chunk is large by nature; it is lazy-loaded, never on first paint.
      chunkSizeWarningLimit: single ? 5000 : 2000,
      assetsInlineLimit: single ? 100_000_000 : 0,
    },
  };
});
