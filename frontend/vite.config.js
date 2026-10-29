import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built assets load regardless of how the app is proxied.
// `npm run dev` proxies /api to a local `uvicorn app:app` on :8000.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8000" } },
});
