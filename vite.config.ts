import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["logo-defender.png", "robots.txt"],
      manifest: {
        name: "Defender Seguridad Privada",
        short_name: "Defender",
        description: "App de control de seguridad privada — monitoreo de turnos, rondines y zonas en tiempo real.",
        theme_color: "#0F172A",
        background_color: "#0F172A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/dashboard",
        scope: "/",
        icons: [
          { src: "/logo-defender.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/logo-defender.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/logo-defender.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // El bundle principal supera 2 MB; sube el límite de precache.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
        // Bundle Web Push handlers into the same SW that manages the
        // app-shell cache, so there is a single service worker per scope.
        importScripts: ["/push-handler.js"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html", networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Keep heavy, rarely-changing libraries out of the entry chunk so the
        // first load stays light on mobile networks (QA observation 6.1).
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-export": ["jspdf", "jspdf-autotable", "xlsx"],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
