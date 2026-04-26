import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  envDir: "..",
  resolve: {
    // ort-web.min.js (the "browser" entry of onnxruntime-web) depends on onnxruntime-common as an
    // external UMD parameter — self.ort — which is never set in a Worker module context, causing the
    // "registerBackend" crash. ort.min.js is the self-contained build: it bundles onnxruntime-common
    // inline and calls its factory with no arguments, so it works in any context without globals.
    alias: {
      "onnxruntime-web": "onnxruntime-web/dist/ort.min.js"
    }
  },
  optimizeDeps: {
    // Both packages ship their own worker/WASM loading path and must stay out of Vite pre-bundling.
    exclude: ["@xenova/transformers", "onnxruntime-web"]
  },
  worker: {
    // transformers.js relies on the worker bundle staying ESM so ONNX runtime can register its backend.
    format: "es"
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000"
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Endgame Grocery",
        short_name: "Grocery",
        description: "Shared grocery planning with offline reads and queued sync.",
        theme_color: "#132238",
        background_color: "#f5f0e8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/api/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-cache"
            }
          }
        ]
      }
    })
  ]
});
