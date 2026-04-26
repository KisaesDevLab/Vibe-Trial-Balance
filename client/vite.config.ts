import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds bake in a sentinel base path so the same image can serve
// either '/' (single-app) or '/<prefix>/' (multi-app behind shared Caddy).
// deploy/web-entrypoint.sh substitutes /__VIBE_BASE_PATH__/ with $VITE_BASE_PATH
// across the built assets at container start.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/__VIBE_BASE_PATH__/' : '/',
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3001'}`,
        changeOrigin: true,
      },
    },
  },
}));
