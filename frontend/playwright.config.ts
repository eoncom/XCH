import { defineConfig, devices } from '@playwright/test';

/**
 * XCH - Configuration Playwright E2E Tests
 *
 * Tests automatisés end-to-end pour l'application XCH
 * Couvre : Auth, Sites, Assets, Tasks, Racks, FloorPlans
 */

export default defineConfig({
  // Répertoire des tests
  testDir: './e2e',

  // Timeout global par test (30s)
  timeout: 30000,

  // Timeout pour les assertions expect (5s)
  expect: {
    timeout: 5000,
  },

  // Configuration de parallélisation
  fullyParallel: true,

  // Nombre de workers (tests en parallèle)
  // CI: 1 worker, Local: 4 workers max
  workers: process.env.CI ? 1 : 4,

  // Nombre de retry en cas d'échec
  // CI: 2 retries, Local: 0 retry
  retries: process.env.CI ? 2 : 0,

  // Reporter pour les résultats
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    ['list'], // Reporter console
  ],

  // Configuration globale
  use: {
    // Base URL de l'application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',

    // API Backend URL
    // Utilisé dans les fixtures pour setup/teardown
    ...(process.env.PLAYWRIGHT_API_URL && {
      extraHTTPHeaders: {
        'X-API-URL': process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002',
      },
    }),

    // Traces en cas d'échec uniquement (optimisation CI)
    trace: 'on-first-retry',

    // Screenshots en cas d'échec
    screenshot: 'only-on-failure',

    // Vidéo en cas d'échec
    video: 'retain-on-failure',

    // Timeout actions (clic, fill, etc.)
    actionTimeout: 10000,

    // Timeout navigation
    navigationTimeout: 15000,

    // Ignorer les erreurs HTTPS (dev/staging)
    ignoreHTTPSErrors: true,
  },

  // Projets de test (browsers)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Mobile tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],

  // Serveur Web - XCH tourne sur serveur distant uniquement
  // Pas de webServer local car application sur 192.168.0.13
  // webServer: undefined,
});
