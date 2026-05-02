import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, "..", ".."), // Читать .env из корня проекта
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Proxy API requests to avoid CORS during development
    proxy: {
      // Proxy requests to the Worker
      '/api': {
        target: import.meta.env.VITE_API_URL || 'https://retrime.korsetov2009.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/'),
        configure: (proxy, options) => {
          // Add Authorization header from localStorage if available
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const token = req.headers['authorization'] || '';
            if (token) {
              proxyReq.setHeader('Authorization', token as string);
            }
          });
        },
      },
      '/auth': {
        target: import.meta.env.VITE_API_URL || 'https://retrime.korsetov2009.workers.dev',
        changeOrigin: true,
        // No rewrite for auth paths
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
