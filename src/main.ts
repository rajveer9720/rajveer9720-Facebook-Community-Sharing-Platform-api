import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = new Set(
    (configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use(helmet());
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
    credentials: true,
  });

  app.use((req: any, res: any, next: any) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!isMutation) {
      next();
      return;
    }

    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (origin && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
      res.status(403).json({
        statusCode: 403,
        message: 'CSRF origin rejected',
        error: 'Forbidden',
      });
      return;
    }

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

bootstrap();
