import 'reflect-metadata';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config } from 'dotenv';

import { AppModule } from './app.module.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDir, '../.env') });

// Cross-origin development configuration
// The web app and API run on different local ports, so the browser treats them
// as different origins. This parser keeps production/deployment origins
// configurable while preserving a practical local fallback.
function getAllowedCorsOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ['http://127.0.0.1:5173', 'http://localhost:5173'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS is a browser boundary: the API can return 200, but the browser still
  // blocks frontend JavaScript unless this header explicitly allows the origin.
  app.enableCors({
    origin: getAllowedCorsOrigins(),
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StackVault API')
    .setDescription('API REST minimale de StackVault')
    .setVersion('0.1.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
}

void bootstrap();
