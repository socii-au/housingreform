import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "https://housing.socii.au/" : "/",
  plugins: [react()],
  build: {
    sourcemap: true
  }
}));


