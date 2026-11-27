import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @tutorial:begin s1-2-vite-import
import tailwindcss from '@tailwindcss/vite';
// @tutorial:end s1-2-vite-import

// The dev server listens on all interfaces so the published port works from the host.
// A course served through a DNS name (for example a department VM) must name that host in
// ALLOWED_HOSTS; IP addresses work without it.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Requests to /api go to the finished API of this module (port 3002, database taskapp_style).
export default defineConfig({
  plugins: [
    react(),
    // @tutorial:begin s1-2-vite-plugin
    tailwindcss(),
    // @tutorial:end s1-2-vite-plugin
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
});
