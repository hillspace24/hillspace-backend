import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function exportSwagger() {
  // Requires a reachable MongoDB (same as the running app).
  // Prefer the checked-in docs/swagger.json when Mongo is unavailable.
  process.env.MONGODB_URI =
    process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/hillspace';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('HillSpace API')
    .setDescription(
      'Estate management backend — auth, listings, search, verification, escrow',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addServer('http://localhost:3000', 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outDir = join(process.cwd(), 'docs');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'swagger.json'),
    JSON.stringify(document, null, 2),
  );

  await app.close();
  // eslint-disable-next-line no-console
  console.log('Wrote docs/swagger.json');
}

exportSwagger().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
