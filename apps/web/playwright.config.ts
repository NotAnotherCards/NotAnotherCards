import { defineConfig } from '@playwright/test';

const baseURL = 'http://localhost:4173';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/live/**',
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    channel: 'chrome',
    launchOptions: { executablePath: process.env.E2E_CHROME_EXECUTABLE },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: ['**/live/**', '**/long-card-layout.spec.ts'],
      use: { viewport: { width: 1440, height: 900 } },
    },
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    {
      name: 'small-phone',
      testMatch: '**/long-card-layout.spec.ts',
      use: { viewport: { width: 360, height: 640 } },
    },
  ],
  webServer: [
    {
      name: 'API',
      cwd: '../api',
      command:
        ': "${DATABASE_URL:?Set DATABASE_URL to a disposable migrated PostgreSQL database}" && mkdir -p ../web/playwright-logs && node dist/src/main.js > ../web/playwright-logs/api.log 2>&1',
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        // Never fall back to the developer database in apps/api/.env.
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        BETTER_AUTH_SECRET:
          'browser-tests-only-secret-252-never-use-in-production',
        BETTER_AUTH_URL: baseURL,
        FRONTEND_URL: baseURL,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        FACEBOOK_CLIENT_ID: '',
        FACEBOOK_CLIENT_SECRET: '',
        AI_API_BASE: '',
        AI_API_KEY: '',
      },
    },
    {
      name: 'Web',
      command:
        'mkdir -p playwright-logs && pnpm preview --host localhost --port 4173 --strictPort > playwright-logs/web.log 2>&1',
      url: baseURL,
      reuseExistingServer: false,
    },
  ],
});
