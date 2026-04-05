import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
