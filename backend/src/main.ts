// MUST stay first : Sentry/GlitchTip init s'attache aux async hooks Node
// AVANT le chargement des libs instrumentées (http, pg, etc.). Tout import
// déplacé au-dessus de cette ligne casserait l'instrumentation silencieusement.
import './common/observability/glitchtip/init';

import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { WorkerModule } from './worker.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Mode detection (ADR-014).
 *
 * The same Docker image is launched twice in production:
 *  - `node dist/main`            → API mode (HTTP, full AppModule)
 *  - `node dist/main --worker`   → worker mode (no HTTP, WorkerModule)
 *
 * Either CLI flag `--worker` or env var `XCH_MODE=worker` activates the
 * worker. CLI flag wins so a single image can be deployed in any mode
 * regardless of inherited environment.
 */
function isWorkerMode(): boolean {
  if (process.argv.includes('--worker')) return true;
  if ((process.env.XCH_MODE || '').toLowerCase() === 'worker') return true;
  return false;
}

async function bootstrapApi() {
  // En prod on coupe 'debug' (verbeux et coûteux en logs/IO/disk).
  // Le dev garde le set complet pour faciliter le debugging.
  const isProd = process.env.NODE_ENV === 'production';
  const logLevels: Array<'error' | 'warn' | 'log' | 'debug' | 'verbose'> = isProd
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug'];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());

  // CORS - When behind nginx proxy, frontend and API share the same origin
  // so most requests are same-origin (no CORS needed). We still allow
  // explicit origins for development (direct backend access on :3002)
  const frontendUrl = configService.get('FRONTEND_URL', '');
  const allowedOrigins = [
    'http://localhost:3001', // Direct frontend dev
    'http://localhost:3002', // Direct backend dev (Swagger)
  ];
  // Add configured FRONTEND_URL if set (for external/cross-origin setups)
  if (frontendUrl) allowedOrigins.push(frontendUrl);

  const trustProxyCors = configService.get('TRUST_PROXY_CORS', 'false') === 'true';

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin via nginx, mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (trustProxyCors) {
        // Behind nginx: trust proxy to control access
        callback(null, true);
      } else {
        console.warn(`🚫 CORS: origin ${origin} rejected (not in allowed list)`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // ✅ CRITICAL for cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
  });

  // Cookie parser (required for HTTP-only cookies auth)
  app.use(cookieParser());

  // Body size — default Express is 100kb which is too tight for operator-uploaded
  // vendor catalogs (the bundled Fortinet JSON is ~85kb and a fuller Cisco /
  // Aruba / HP catalog will easily exceed that). 10MB is generous but still
  // safely bounded against memory-exhaustion DoS (rate limiting covers the rest).
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api');

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ADR-023 — global response serialization through @Expose()/@Exclude() on
  // every *ResponseDto. Combined with `excludeExtraneousValues: true` (in
  // `common/utils/to-response.util.ts`), this guarantees no Prisma raw column
  // leaks into the API response unless the DTO explicitly opted-in.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('XCH API')
      .setDescription('API de gestion IT pour sites temporaires')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   XCH Backend API - Running on http://localhost:${port}    ║
  ║   Swagger Docs: http://localhost:${port}/api/docs         ║
  ║   Environment: ${configService.get('NODE_ENV', 'development').padEnd(11)}                              ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
}

async function bootstrapWorker() {
  const logger = new Logger('Worker');
  const isProd = process.env.NODE_ENV === 'production';
  const logLevels: Array<'error' | 'warn' | 'log' | 'debug' | 'verbose'> = isProd
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug'];

  // Standalone application context — loads providers, runs onModuleInit
  // hooks, but does NOT start an HTTP server. The worker has no inbound
  // surface (ADR-014).
  const ctx = await NestFactory.createApplicationContext(WorkerModule, {
    logger: logLevels,
  });

  // Graceful shutdown so BullMQ stops consuming and Prisma disconnects
  // cleanly when the container receives SIGTERM (docker stop).
  ctx.enableShutdownHooks();

  logger.log('XCH Backend Worker — running (no HTTP). Mode: monitoring probes.');
}

async function bootstrap() {
  if (isWorkerMode()) {
    await bootstrapWorker();
  } else {
    await bootstrapApi();
  }
}

bootstrap();
