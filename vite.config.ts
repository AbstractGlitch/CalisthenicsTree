import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

// The service worker is generated, not hand-written. magnetic-practice maintains its
// sw.js ASSETS array by hand, which is fine for six unhashed files and breaks the moment
// there are hashed bundles -- exactly the situation here.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Calisthenics Tree",
        short_name: "Tree",
        description: "Track your progress through the calisthenics skill tree.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0c0d12",
        theme_color: "#0c0d12",
        icons: [
          { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "./icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
