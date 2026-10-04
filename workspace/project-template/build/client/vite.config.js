import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server listens on all interfaces so the published port works from the host.
// Requests to /api are forwarded to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
