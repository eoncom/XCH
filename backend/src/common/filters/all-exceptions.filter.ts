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
    // Unknown errors
    else {
      const err = exception as Error;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err?.message || exception}`,
        err?.stack,
      );
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
