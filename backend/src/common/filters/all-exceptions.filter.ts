import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    // NestJS HttpException (includes BadRequest, NotFound, Conflict, Forbidden, Unauthorized...)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || message;
        error = (res as any).error || error;
      }
    }
    // Prisma known errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          // Unique constraint violation
          status = HttpStatus.CONFLICT;
          const fields = (exception.meta?.target as string[])?.join(', ') || 'unknown field';
          message = `A record with this ${fields} already exists`;
          error = 'Conflict';
          break;
        }
        case 'P2025': {
          // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          error = 'Not Found';
          break;
        }
        case 'P2003': {
          // Foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          message = 'Cannot complete this operation: related records exist';
          error = 'Bad Request';
          break;
        }
        case 'P2014': {
          // Required relation violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Required relation violation';
          error = 'Bad Request';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = 'Database operation failed';
          error = 'Bad Request';
        }
      }
      this.logger.warn(
        `Prisma error ${exception.code} on ${request.method} ${request.url}: ${exception.message}`,
      );
    }
    // Prisma validation errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'Bad Request';
      this.logger.warn(`Prisma validation error on ${request.method} ${request.url}`);
    }
    // Unknown errors — la branche "actionable" pour l'observabilité.
    // HttpException et Prisma known errors ci-dessus sont des sorties business
    // attendues (validation, conflit, not-found) → spam Sentry si capturés.
    // On envoie UNIQUEMENT les unhandled à GlitchTip pour signal/bruit propre.
    else {
      const err = exception as Error;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err?.message || exception}`,
        err?.stack,
      );

      // S8 : route vers GlitchTip self-hosted (DSN backend = interne Docker).
      // Si DSN absent (dev local), Sentry.captureException reste no-op silencieux.
      // user.id only (pas d'email — décision XCH 2026-05-08), tags request,
      // scrubber `beforeSend` filet anti-leak final côté init.ts.
      const userId = (request as Request & { user?: { id?: string } }).user?.id;
      Sentry.captureException(err, {
        tags: {
          method: request.method,
          // route?.path = pattern Express (`/api/users/:id`) → pas d'IDs
          // dans les tags qui généreraient une explosion de cardinalité.
          route: (request as Request & { route?: { path?: string } }).route?.path || 'unknown',
        },
        extra: {
          status_code: status,
          path: request.url,
        },
        user: userId ? { id: userId } : undefined,
      });
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
