import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Two groups of tests: files ending in .test.js run in plain Node (fast, for server code),
// files ending in .test.jsx run in a simulated browser (jsdom) with Testing Library ready to use.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'server', environment: 'node', include: ['tests/**/*.test.js'] } },
      { extends: true, test: { name: 'client', environment: 'jsdom', include: ['tests/**/*.test.jsx'], setupFiles: ['./vitest.setup.js'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text'],
      // Reachable without the optional checkpoint exercises; with them coverage is above 90%.
      thresholds: { statements: 40, functions: 30, branches: 40, lines: 40 },
    },
  },
});
