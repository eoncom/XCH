import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

/**
 * Custom throttler guard — translates the 429 response body from the upstream
 * English "Too Many Requests" / "ThrottlerException" into a user-facing French
 * message. Wraps the same suppression logic as the stock guard; only the
 * thrown exception text changes.
 */
@Injectable()
export class XchThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message:
          'Trop de tentatives. Merci de patienter une minute avant de réessayer.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
