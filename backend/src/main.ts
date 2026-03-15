import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
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

  // Compression
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api');

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

bootstrap();
