import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/env";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: config.nodeEnv === "production"
      ? ["error", "warn", "log"]
      : ["error", "warn", "log", "debug"],
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.useBodyParser("json", { limit: "2mb" });
  app.enableCors({
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: [
      "content-type",
      "x-erp-client-id",
      "x-erp-timestamp",
      "x-erp-tenant-id",
      "x-erp-actor",
      "x-erp-idempotency-key",
      "x-erp-signature",
    ],
    maxAge: 3_600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(config.port, "0.0.0.0");
}

void bootstrap();
