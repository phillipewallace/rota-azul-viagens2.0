import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração Playwright para testes E2E.
 *
 * Como rodar localmente (uma única vez):
 *   bun add -D @playwright/test
 *   bunx playwright install chromium
 *
 * Em seguida:
 *   bun run e2e            # roda os testes
 *   bun run e2e:ui         # modo interativo
 *
 * O webServer abaixo sobe o Vite automaticamente antes dos testes.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
