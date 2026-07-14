import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// For GitHub Pages set VITE_BASE_PATH to "/<repository-name>/" (the deploy
// workflow does this automatically). Vercel and local dev use the default "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
