import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig } from "./config/env";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: config.nodeEnv === "production"
      ? ["error", "warn", "log"]
      : ["error", "warn", "log", "debug"],
  });
  app.enableShutdownHooks();
}

void bootstrap();
