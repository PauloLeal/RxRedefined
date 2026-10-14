import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the Docker port mapping works
    port: 5173,
    strictPort: true,
    // The browser calls /api/...; Vite forwards it to the API, so there is no CORS to deal with.
    // API_URL is http://api:4000 inside docker-compose-app.yml.
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.tsx'],
  },
});
