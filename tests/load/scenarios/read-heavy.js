/* eslint-disable */
// read-heavy.js — k6 read-heavy scenario (50 VUs, 5min).
//
// 70% of mixed traffic. Stress endpoints that LIST tenant-scoped collections
// (assets/sites/tasks). Detects N+1 via Prisma logs (DEBUG=prisma:query) and
// p95 read SLA breaches.
//
// Threshold (from k6-config.json) : p95 < 500ms, p99 < 2s, error rate < 1%.
//
// Run :
//   k6 run tests/load/scenarios/read-heavy.js \
//     -e K6_BASE_URL=http://localhost:3000

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login, randint } from '../helpers.js';

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    'http_req_duration{group:read}': ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  return login();
}

export default function (data) {
  const headers = { Cookie: data.cookie };

  group('read', () => {
    // /api/assets paginated (70% of read traffic — heaviest endpoint)
    const offset = randint(0, 9000);
    const r1 = http.get(`${BASE_URL}/api/assets?limit=50&offset=${offset}`, {
      headers,
      tags: { endpoint: 'assets-list' },
    });
    check(r1, { 'assets 200': (r) => r.status === 200 });

    // /api/sites (20%)
    if (Math.random() < 0.3) {
      const r2 = http.get(`${BASE_URL}/api/sites`, {
        headers,
        tags: { endpoint: 'sites-list' },
      });
      check(r2, { 'sites 200': (r) => r.status === 200 });
    }

    // /api/tasks (10%)
    if (Math.random() < 0.15) {
      const r3 = http.get(`${BASE_URL}/api/tasks?status=open&limit=50`, {
        headers,
        tags: { endpoint: 'tasks-list' },
      });
      check(r3, { 'tasks 200': (r) => r.status === 200 });
    }
  });

  sleep(Math.random() * 0.5);
}
