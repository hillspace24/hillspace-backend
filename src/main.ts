import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = (process.env.FRONTEND_URL?.trim() || '').replace(/\/$/, '');
  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set(
    ['http://localhost:3000', 'http://127.0.0.1:3000', frontendUrl, ...extraOrigins].filter(
      Boolean,
    ),
  );
  const isLocalDevOrigin = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const renderUrl = (
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    'https://hillspace-backend.onrender.com'
  )
    .replace(/\/$/, '')
    .replace(/\/api$/, '');

  const swaggerBuilder = new DocumentBuilder()
    .setTitle('HillSpace API')
    .setDescription(
      'Estate management backend — auth, listings, search, verification, escrow',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    );

  if (process.env.RENDER_EXTERNAL_URL) {
    swaggerBuilder
      .addServer(renderUrl, 'Render')
      .addServer('http://localhost:3000', 'Local');
  } else {
    swaggerBuilder
      .addServer('http://localhost:3000', 'Local')
      .addServer(renderUrl, 'Render');
  }

  const swagger = swaggerBuilder.build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
bootstrap();
