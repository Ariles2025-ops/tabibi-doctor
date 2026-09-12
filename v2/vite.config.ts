import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build en fichiers statiques : se déploie exactement comme le site actuel
// (Cloudflare Pages) et s'embarque tel quel dans Capacitor.
export default defineConfig({
  plugins: [react()],
  // Sert la v2 sous /v2/ pour cohabiter avec le site actuel à la racine.
  base: '/v2/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
  server: { port: 5173 },
});
