/* eslint-disable */
// audit-heavy.js — k6 audit-heavy scenario (5 VUs, 5min).
//
// 10% of mixed traffic. Stresses the audit_logs composite index added in PR1
// (@@index([tenantId, delegationId, timestamp])) via `GET /api/audit` with
// delegationId filter + 90-day window.
//
// Threshold : p95 audit < 500ms (read SLA), p99 < 2s, error rate < 1%.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login, randomFrom } from '../helpers.js';

export const options = {
  vus: 5,
  duration: '5m',
  thresholds: {
    'http_req_duration{endpoint:audit-list}': ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const data = login();
  // Discover available delegations to filter on
  const delegRes = http.get(`${BASE_URL}/api/organization/delegations`, {
    headers: { Cookie: data.cookie },
  });
  let delegationIds = [];
  try {
    const body = delegRes.json();
    delegationIds = (Array.isArray(body) ? body : body.data || []).map((d) => d.id);
  } catch (_) {
    delegationIds = [];
  }
  return { ...data, delegationIds };
}

export default function (data) {
  const headers = { Cookie: data.cookie };

  group('read', () => {
    const has = data.delegationIds.length > 0;
    const filter = has
      ? `?delegationId=${randomFrom(data.delegationIds)}&limit=100`
      : '?limit=100';
    const r = http.get(`${BASE_URL}/api/audit${filter}`, {
      headers,
      tags: { endpoint: 'audit-list' },
    });
    check(r, { 'audit 200': (x) => x.status === 200 });
  });

  sleep(Math.random() * 0.5);
}
