// XCH frontend Lighthouse CI config — Track E.4 PR2 Pass 4.1.
//
// Single config covers 10 pages. Base URL defaults to nginx single-origin CI
// stack (cf docker-compose.ci.yml + e2e-tests.yml). Override via env :
//   LHCI_BASE_URL=http://localhost:3001  # local dev (Next dev server direct)
//
// Konva pages (floor-plans, monitoring) excluded from strict a11y assertion
// per Decision D7 (canvas elements lack ARIA exploitable). Asserted at
// >=0.50 instead of >=0.70.
//
// Plan reference : docs/perf/a11y-baseline-2026-05-16.md §thresholds.

const BASE = process.env.LHCI_BASE_URL || 'http://localhost:8080';

const STANDARD_URLS = [
  `${BASE}/auth/login`,
  `${BASE}/dashboard`,
  `${BASE}/dashboard/sites`,
  `${BASE}/dashboard/assets`,
  `${BASE}/dashboard/tasks`,
  `${BASE}/dashboard/costs`,
  `${BASE}/dashboard/users`,
  `${BASE}/dashboard/settings`,
];

const KONVA_URLS = [
  `${BASE}/dashboard/floor-plans`,
  `${BASE}/dashboard/monitoring`,
];

module.exports = {
  ci: {
    collect: {
      url: [...STANDARD_URLS, ...KONVA_URLS],
      numberOfRuns: 1,
      // Set if you need to pass cookies via puppeteer launch (auth pages).
      // Default headless chromium without auth — login page works
      // unauthenticated; protected dashboard pages will redirect to /login,
      // which Lighthouse will analyze instead (still useful for layout).
      // For authed runs, use --extra-headers '{"Cookie":"accessToken=..."}'
      // via env LHCI_COLLECT__EXTRA_HEADERS at the autorun call site.
      settings: {
        // Skip prefilled cookies fetch to keep CI reproducible
        emulatedFormFactor: 'desktop',
        throttling: { cpuSlowdownMultiplier: 1 },
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertMatrix: [
        {
          matchingUrlPattern: '/dashboard/(floor-plans|monitoring)',
          assertions: {
            'categories:accessibility': ['warn', { minScore: 0.5 }],
            'categories:performance': ['warn', { minScore: 0.4 }],
            'categories:best-practices': ['warn', { minScore: 0.5 }],
            // Disable rules that are noise on Konva canvas pages
            'image-alt': 'off',
            'aria-required-attr': 'off',
          },
        },
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:accessibility': ['error', { minScore: 0.7 }],
            'categories:performance': ['warn', { minScore: 0.5 }],
            'categories:best-practices': ['warn', { minScore: 0.7 }],
          },
        },
      ],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
