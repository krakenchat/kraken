import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Kraken API')
    .setDescription('Kraken Chat Application API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // __dirname is dist/src/ when compiled, so go up two levels to project root
  writeFileSync(
    resolve(__dirname, '..', '..', 'openapi.json'),
    JSON.stringify(document, null, 2),
  );
  console.log('OpenAPI spec written to openapi.json');

  await app.close();
}

generate();
