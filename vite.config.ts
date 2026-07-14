import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// For GitHub Pages set VITE_BASE_PATH to "/<repository-name>/" (the deploy
// workflow does this automatically). Vercel and local dev use the default "/".
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app: manifest + a service worker that precaches the app
    // shell (works offline / loads instantly) and auto-updates on deploys.
    // Supabase requests are NOT cached — family data stays live.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Oq-Ariq OILASI',
        short_name: 'Oq-Ariq',
        description: 'Oq-Ariq oilaviy shajara sayti — family tree',
        theme_color: '#0c0a09',
        background_color: '#0c0a09',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      output: {
        // Split the always-loaded framework code into its own chunk so it
        // stays cached across deploys (app code changes far more often).
        // The heavy, route-only libs (React Flow, Leaflet, html-to-image)
        // are left to Rollup, which puts them in their lazy page chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (id.includes('@supabase')) return 'supabase';
        },
      },
    },
  },
});
