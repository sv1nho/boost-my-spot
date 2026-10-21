import { defineConfig, devices } from '@playwright/test'
import { e2eDatabaseUrl } from './e2e/database.js'

const databaseUrl = (): string =>
  process.env.DATABASE_URL === undefined ? '' : e2eDatabaseUrl()

const PORT = 3101
const BASE_URL = `http://127.0.0.1:${String(PORT)}`

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 1 : 0,
  reporter: process.env.CI === 'true' ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /sign-in\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/state.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'tsx scripts/fake-upstream.ts',
      url: 'http://127.0.0.1:3199/upgrader/stock',
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run e2e:db && npm run build:web && npm run start:api',
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        E2E_AUTH: 'true',
        API_PORT: String(PORT),
        API_HOST: '127.0.0.1',
        WEB_ORIGIN: BASE_URL,
        BETTER_AUTH_URL: BASE_URL,
        DATABASE_URL: databaseUrl(),
        RATE_LIMIT_PER_MINUTE: '100000',
        ADMIN_EMAILS: 'browser-test@boostmyspot.test',
      },
    },
  ],
})
