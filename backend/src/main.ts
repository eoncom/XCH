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

  // CORS - Allow both frontend URLs (xch.eoncom.io and xchapi.eoncom.io routing)
  const frontendUrl = configService.get('FRONTEND_URL', 'http://localhost:3000');
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3001', // Local development
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`❌ CORS blocked origin: ${origin}`);
        callback(null, false); // Reject without error
      }
    },
    credentials: true, // ✅ CRITICAL pour cookies cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

  const port = configService.get('PORT', 3001);
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
