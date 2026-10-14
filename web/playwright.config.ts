import { defineConfig, devices } from '@playwright/test';

// Runs on the host machine (needs Node 22, Docker and `npm install` locally).
// If the apps are already up (for example via docker-compose-app.yml), they are reused.
// Otherwise Playwright boots everything: Postgres if it is not running (scripts/ensure-postgres.mjs),
// then the API (after re-seeding the database) and the web app.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/ensure-postgres.mjs && npm run db:setup --prefix ../api && npm run start --prefix ../api',
      url: 'http://localhost:4000/orders/queue',
      reuseExistingServer: true,
      timeout: 120_000, // includes starting Postgres on a cold machine
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
