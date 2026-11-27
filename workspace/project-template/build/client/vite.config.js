import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server listens on all interfaces so the published port works from the host.
// A course served through a DNS name (for example a department VM) must name that host in
// ALLOWED_HOSTS; IP addresses work without it.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Requests to /api are forwarded to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
