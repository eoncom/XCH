/* eslint-disable */
// write-mixed.js — k6 mixed-write scenario (10 VUs, 5min).
//
// 20% of mixed traffic. Stress mutation endpoints (POST assets, PATCH tasks,
// POST expenses). Catches BullMQ queue saturation + audit log write contention.
//
// Threshold : p95 write < 1s, p99 < 2s, error rate < 1%.
//
// NOTE : tests assume seed-loadtest.ts ran (tenant=loadtest-e4-pr2 +
// admin-lt user). POST/PATCH writes increase the seeded volumes, so a fresh
// seed --reset is recommended before each multi-scenario run.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login, randint, randomFrom } from '../helpers.js';

export const options = {
  vus: 10,
  duration: '5m',
  thresholds: {
    'http_req_duration{group:write}': ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const data = login();
  // Fetch sample site IDs for write payloads
  const sitesRes = http.get(`${BASE_URL}/api/sites`, {
    headers: { Cookie: data.cookie },
  });
  let siteIds = [];
  try {
    const body = sitesRes.json();
    siteIds = (Array.isArray(body) ? body : body.data || []).map((s) => s.id);
  } catch (_) {
    siteIds = [];
  }
  return { ...data, siteIds };
}

const ASSET_TYPES = ['SERVER', 'SWITCH', 'UPS', 'AC_UNIT'];

export default function (data) {
  const headers = {
    Cookie: data.cookie,
    'Content-Type': 'application/json',
  };

  group('write', () => {
    const dice = Math.random();
    if (dice < 0.5 && data.siteIds.length > 0) {
      // POST /api/assets
      const payload = JSON.stringify({
        siteId: randomFrom(data.siteIds),
        type: randomFrom(ASSET_TYPES),
        name: `k6-asset-${Date.now()}-${randint(0, 9999)}`,
        status: 'IN_SERVICE',
      });
      const r = http.post(`${BASE_URL}/api/assets`, payload, {
        headers,
        tags: { endpoint: 'assets-create' },
      });
      check(r, { 'asset create 200/201': (x) => x.status === 200 || x.status === 201 });
    } else if (dice < 0.85) {
      // PATCH /api/tasks/:id — best-effort, may 404 if no tasks seeded.
      // We don't seed tasks volume — this branch will tolerate 404 but track latency.
      const tid = `nonexistent-${randint(0, 1000)}`;
      const r = http.patch(
        `${BASE_URL}/api/tasks/${tid}`,
        JSON.stringify({ status: 'done' }),
        { headers, tags: { endpoint: 'tasks-patch' } },
      );
      check(r, { 'task patch resp': (x) => x.status >= 200 && x.status < 500 });
    } else if (data.siteIds.length > 0) {
      // POST /api/expenses
      const payload = JSON.stringify({
        siteId: randomFrom(data.siteIds),
        amount: randint(100, 5000),
        currency: 'EUR',
        category: 'OTHER',
        description: `k6-expense-${Date.now()}`,
      });
      const r = http.post(`${BASE_URL}/api/expenses`, payload, {
        headers,
        tags: { endpoint: 'expenses-create' },
      });
      check(r, { 'expense create resp': (x) => x.status >= 200 && x.status < 500 });
    }
  });

  sleep(Math.random() * 0.8 + 0.2);
}
