/* eslint-disable */
// Track E.4 PR2 Pass 4.2 — axe-core a11y spec.
//
// Asserts 0 violation `critical`/`serious` (WCAG 2.0 AA) on 8 standard pages.
// 2 Konva canvas pages (floor-plans, monitoring) are scanned but assertions
// are non-blocking per Decision D7 (canvas lacks exploitable ARIA).
//
// Reuses login fixture frontend/e2e/fixtures/auth.fixture.ts (admin@demo.fr
// / Demo1234, demo seed). For Konva-excluded pages, results are logged for
// the baseline report only.

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/auth.fixture';

interface A11yPage {
  path: string;
  auth: boolean;
  konva: boolean;
}

const A11Y_PAGES: A11yPage[] = [
  { path: '/auth/login', auth: false, konva: false },
  { path: '/dashboard', auth: true, konva: false },
  { path: '/dashboard/sites', auth: true, konva: false },
  { path: '/dashboard/assets', auth: true, konva: false },
  { path: '/dashboard/tasks', auth: true, konva: false },
  { path: '/dashboard/costs', auth: true, konva: false },
  { path: '/dashboard/users', auth: true, konva: false },
  { path: '/dashboard/settings', auth: true, konva: false },
  { path: '/dashboard/floor-plans', auth: true, konva: true },
  { path: '/dashboard/monitoring', auth: true, konva: true },
];

test.describe('a11y baseline (axe-core, WCAG2 AA)', () => {
  for (const { path, auth, konva } of A11Y_PAGES) {
    test(`${path} ${konva ? '(Konva — soft)' : ''}`, async ({
      page,
      loginAsAdmin,
    }) => {
      if (auth) {
        await loginAsAdmin();
      }
      await page.goto(path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      // Always log the breakdown for the baseline rapport
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            page: path,
            konva,
            counts: {
              critical: results.violations.filter((v) => v.impact === 'critical').length,
              serious: results.violations.filter((v) => v.impact === 'serious').length,
              moderate: results.violations.filter((v) => v.impact === 'moderate').length,
              minor: results.violations.filter((v) => v.impact === 'minor').length,
            },
            topRules: results.violations.slice(0, 5).map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.length,
              helpUrl: v.helpUrl,
            })),
          },
          null,
          2,
        ),
      );

      if (!konva) {
        expect(
          blocking,
          `${path}: ${blocking.length} blocking violation(s):\n${JSON.stringify(
            blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
            null,
            2,
          )}`,
        ).toHaveLength(0);
      }
    });
  }
});
