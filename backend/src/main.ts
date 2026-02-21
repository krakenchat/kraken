import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { TimingInterceptor } from './timing/timing.interceptor';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

const KNOWN_WEAK_SECRETS = [
  'some long elaborate secret that you really need to change',
  'a different long elaborate secret to change',
];

function validateSecrets() {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (
    jwtSecret &&
    jwtRefreshSecret &&
    (KNOWN_WEAK_SECRETS.includes(jwtSecret) ||
      KNOWN_WEAK_SECRETS.includes(jwtRefreshSecret))
  ) {
    const message =
      'SECURITY: JWT secrets are set to default sample values. ' +
      'Generate secure secrets with: openssl rand -base64 64';
    if (isProduction) {
      throw new Error(message + ' — refusing to start in production mode.');
    } else {
      console.warn(`\n⚠️  WARNING: ${message}\n`);
    }
  }
}

async function bootstrap() {
  validateSecrets();

  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'KrakenChat',
      timestamp: true,
      json: true,
    }),
    bufferLogs: true,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  app.useWebSocketAdapter(redisIoAdapter);

  app.useGlobalInterceptors(new TimingInterceptor());
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP can break frontend asset loading; configure per-deployment
      crossOriginEmbedderPolicy: false, // Can break embedded media
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const enableSwagger =
    process.env.ENABLE_SWAGGER === 'true' ||
    (process.env.ENABLE_SWAGGER === undefined &&
      process.env.NODE_ENV !== 'production');
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kraken API')
      .setDescription('Kraken Chat Application API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
