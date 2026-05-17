/* eslint-disable */
// helpers.js — Track E.4 PR2 Pass 3.2 — shared k6 utilities.
//
// Login flow: POST /api/auth/login with loadtest admin → captures session cookie
// (HTTP-only, secure-prod, lax-dev). k6 http.cookieJar() carries it across reqs.
//
// Usage (in scenario file) :
//   import http from 'k6/http';
//   import { check } from 'k6';
//   import { login, BASE_URL, randomFrom, randint } from './helpers.js';
//   export function setup() { return login(); }
//   export default function (data) {
//     const headers = { Cookie: data.cookie };
//     const res = http.get(`${BASE_URL}/api/sites`, { headers });
//     check(res, { 'status 200': r => r.status === 200 });
//   }

import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
export const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || 'admin-lt@loadtest.local';
export const ADMIN_PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'Loadtest1234';

export function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const ok = check(res, {
    'login 200/201': (r) => r.status === 200 || r.status === 201,
  });
  if (!ok) {
    fail(`login failed status=${res.status} body=${res.body}`);
  }
  // Capture Set-Cookie (session). NestJS @nestjs/passport-local emits it.
  const setCookie = res.headers['Set-Cookie'] || '';
  return { cookie: setCookie.split(';')[0] };
}

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randint(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
