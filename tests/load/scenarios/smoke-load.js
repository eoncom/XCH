/* eslint-disable */
// smoke-load.js — k6 sanity scenario (5 VUs, 30s).
//
// Pre-merge garde-fou : confirme stack répond pendant 30s avec 5 VUs.
// Pas de threshold strict — l'objectif est "does it boot under any load".
//
// Run :
//   k6 run tests/load/scenarios/smoke-load.js \
//     -e K6_BASE_URL=http://localhost:3000

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login } from '../helpers.js';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  return login();
}

export default function (data) {
  const headers = { Cookie: data.cookie };
  group('smoke', () => {
    // /api/setup/status preferred over /api/health: works in CI without
    // MinIO service (load-test.yml only provides postgres + redis).
    // For prod sanity, /api/health is the canonical probe (cf. smoke-prod.sh).
    const r1 = http.get(`${BASE_URL}/api/setup/status`, { headers });
    check(r1, { '/api/setup/status 200': (r) => r.status === 200 });

    const r2 = http.get(`${BASE_URL}/api/sites`, { headers });
    check(r2, { '/api/sites 200': (r) => r.status === 200 });

    const r3 = http.get(`${BASE_URL}/api/assets?limit=10`, { headers });
    check(r3, { '/api/assets 200': (r) => r.status === 200 });
  });
  sleep(1);
}
