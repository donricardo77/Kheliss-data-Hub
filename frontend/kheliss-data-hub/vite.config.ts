import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Default values for Vercel and production environments
const rawPort = process.env.PORT || "5177";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Base path defaults to "/" for Vercel SPA routing
const basePath = "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react({
      fastRefresh: true,
      jsxImportSource: "react",
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "wouter",
      "lucide-react",
      "clsx",
    ],
    exclude: ["@workspace/api-client-react"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: false,
      deny: ["**/.*"],
    },
    middlewareMode: false,
    hmr: {
      host: "localhost",
      port: port,
      protocol: "ws",
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
