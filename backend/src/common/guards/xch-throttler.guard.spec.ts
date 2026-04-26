import { HttpException, HttpStatus } from '@nestjs/common';
import { XchThrottlerGuard } from './xch-throttler.guard';

/**
 * S4 — XchThrottlerGuard simply overrides throwThrottlingException() to
 * return a French error body. We test the protected method directly via a
 * subclass that re-exports it.
 */
class ExposedThrottler extends XchThrottlerGuard {
  public callThrow(): Promise<void> {
    return this.throwThrottlingException();
  }
}

describe('XchThrottlerGuard', () => {
  it('throws HTTP 429 with the French message', async () => {
    // Cast to any because the parent constructor expects ThrottlerGuard
    // dependencies — we only call the protected helper, never the full
    // canActivate(), so dummy DI is fine here.
    const guard = new ExposedThrottler({} as any, {} as any, {} as any);

    await expect(guard.callThrow()).rejects.toBeInstanceOf(HttpException);

    try {
      await guard.callThrow();
      fail('Expected HttpException to be thrown');
    } catch (err) {
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = ex.getResponse() as {
        statusCode: number;
        error: string;
        message: string;
      };
      expect(body.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toMatch(/Trop de tentatives/);
      expect(body.message).toMatch(/patienter/);
    }
  });
});
