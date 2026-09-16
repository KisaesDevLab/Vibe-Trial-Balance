import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds bake in a sentinel base path so the same image can serve
// either '/' (single-app) or '/<prefix>/' (multi-app behind shared Caddy).
// deploy/web-entrypoint.sh substitutes /__VIBE_BASE_PATH__/ with $VITE_BASE_PATH
// across the built assets at container start.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/__VIBE_BASE_PATH__/' : '/',
  plugins: [react()],
  resolve: {
    // @kisaesdevlab/vibe-auth is a `file:` link into a sibling checkout that has its
    // own node_modules. Pin React to this project's copy so its components
    // can never resolve a second one (two Reacts break hooks).
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3001'}`,
        changeOrigin: true,
      },
      // Vibe Auth (single sign-on) lives outside /api: /auth/status, /auth/oidc/*, /auth/settings.
      '^/auth(/|$)': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3001'}`,
        changeOrigin: true,
      },
    },
  },
}));
