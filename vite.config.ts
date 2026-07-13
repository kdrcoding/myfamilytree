import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// For GitHub Pages set VITE_BASE_PATH to "/<repository-name>/" (the deploy
// workflow does this automatically). Vercel and local dev use the default "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH ?? '/',
});
