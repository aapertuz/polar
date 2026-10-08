import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
    {
      name: "polar-development-identity",
      configureServer(server) {
        server.middlewares.use("/__polar_dev", (_request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(
            JSON.stringify({
              kind: "polar-vite",
              root: decodeURIComponent(new URL("..", import.meta.url).pathname).replace(/\/$/, ""),
              pid: process.pid,
              session: process.env.POLAR_DEV_SESSION || null,
            }),
          );
        });
      },
    },
  ],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
