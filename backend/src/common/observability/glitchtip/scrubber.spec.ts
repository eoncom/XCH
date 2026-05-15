import type { Event } from '@sentry/node';
import { scrubEvent, SECRET_REGEX_BUNDLE } from './scrubber';

/**
 * Track D.2 Step 3 — scrubEvent applied to BOTH error events AND
 * transactions (parité ADR-024 fail-closed étendue).
 *
 * The bundle is now wired into init.ts via `beforeSendTransaction = scrubEvent`,
 * so a leaked PII pattern in a span/transaction MUST drop the entire event
 * just like for error events. These tests assert the strict fail-closed
 * invariant across 3 distinct leak emplacements on a `transaction`-typed
 * Event (ajustement #2 in the D.2 plan).
 */
describe('scrubEvent on transaction-typed Event (Track D.2 Step 3)', () => {
  /** Minimal valid transaction Event shape for `scrubEvent` input. */
  function makeTransactionEvent(overrides: Partial<Event> = {}): Event {
    return {
      type: 'transaction',
      transaction: 'backup.archive-build',
      contexts: {
        trace: {
          op: 'backup.archive-build',
          trace_id: '00000000000000000000000000000000',
          span_id: '0000000000000000',
        },
      },
      spans: [],
      ...overrides,
    } as Event;
  }

  it('passes through a clean transaction (no PII)', () => {
    const ev = makeTransactionEvent({
      tags: { tenant_id: 'tnt_abc', backup_format_version: '2' },
    });
    expect(scrubEvent(ev)).not.toBeNull();
  });

  it('SECRET_REGEX_BUNDLE shape is identical between error + transaction paths', () => {
    // Sanity: same bundle, same instance, single source of truth.
    expect(SECRET_REGEX_BUNDLE.length).toBeGreaterThan(0);
    // The bundle should match a known bad value (bcrypt prefix).
    expect(SECRET_REGEX_BUNDLE.some((re) => re.test('$2b$10$xxx'))).toBe(true);
  });

  // ==========================================================================
  // 3 emplacements PII — fail-closed strict
  // ==========================================================================

  it('(a) drops transaction when PII leaks in span.description', () => {
    const ev = makeTransactionEvent({
      spans: [
        {
          op: 'backup.archive-build',
          // 'passwordHash' is a SECRET_REGEX_BUNDLE field name —
          // any leak into a description must drop the event.
          description: 'iterating passwordHash columns',
          trace_id: '00000000000000000000000000000000',
          span_id: '0000000000000000',
          start_timestamp: 0,
          timestamp: 0,
        } as never,
      ],
    });
    expect(scrubEvent(ev)).toBeNull();
  });

  it('(b) drops transaction when PII leaks in span.attributes value', () => {
    const ev = makeTransactionEvent({
      spans: [
        {
          op: 'backup.upload',
          description: 'fputObject',
          // A value-shaped leak: bcrypt prefix injected into a tag's value
          // — would be flagged by /\$2[aby]\$/ in the bundle.
          data: { tenant_id: '$2b$10$RealLookingBcryptValueXYZ' },
          trace_id: '00000000000000000000000000000000',
          span_id: '0000000000000000',
          start_timestamp: 0,
          timestamp: 0,
        } as never,
      ],
    });
    expect(scrubEvent(ev)).toBeNull();
  });

  it('(c) drops transaction when PII leaks in transaction.tags value', () => {
    const ev = makeTransactionEvent({
      tags: {
        // A TOTP base32 canonical sample is one of the bundle patterns —
        // even if shoved into a top-level tag, the bundle must catch it.
        user_id: 'JBSWY3DPEHPK3PXP',
      },
    });
    expect(scrubEvent(ev)).toBeNull();
  });

  // ==========================================================================
  // Field-name leaks in attributes — keys are part of the JSON serialization
  // ==========================================================================

  it('drops transaction when SECRET_REGEX field name appears as an attribute key', () => {
    const ev = makeTransactionEvent({
      spans: [
        {
          op: 'backup.restore',
          description: 'apply phase 1',
          // The bundle includes /resetToken/ — a key match suffices because
          // serialize-then-regex sees `"resetToken":...` in the payload.
          data: { resetToken: 'whatever-string' },
          trace_id: '00000000000000000000000000000000',
          span_id: '0000000000000000',
          start_timestamp: 0,
          timestamp: 0,
        } as never,
      ],
    });
    expect(scrubEvent(ev)).toBeNull();
  });

  // ==========================================================================
  // Cleanup paths (user/request) also apply to transactions
  // ==========================================================================

  it('strips user.email + cookies + auth headers from a transaction', () => {
    const ev = makeTransactionEvent({
      user: { id: 'u-uuid-123', email: 'leak@example.com', username: 'leaky' },
      request: {
        url: 'https://x/backup',
        cookies: { session: 'abc' },
        headers: { authorization: 'Bearer XYZ', cookie: 'x=y', 'x-csrf-token': 'csrf' },
        data: { secretField: 'whatever' },
      },
    });
    const result = scrubEvent(ev);
    expect(result).not.toBeNull();
    expect(result?.user).toEqual({ id: 'u-uuid-123' });
    expect(result?.request?.cookies).toBeUndefined();
    expect((result?.request?.headers as Record<string, string> | undefined)?.authorization).toBeUndefined();
    expect((result?.request?.headers as Record<string, string> | undefined)?.cookie).toBeUndefined();
    expect((result?.request?.headers as Record<string, string> | undefined)?.['x-csrf-token']).toBeUndefined();
    expect(result?.request?.data).toBeUndefined();
  });
});
