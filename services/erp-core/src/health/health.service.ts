import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import Redis from "ioredis";
import { loadConfig } from "../config/env";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async ready() {
    const checks = {
      postgres: false,
      redis: false,
      worker: false,
    };
    try {
      checks.postgres = await this.database.ping();
      const redis = new Redis(loadConfig().redisUrl, {
        lazyConnect: true,
        connectTimeout: 2_000,
        commandTimeout: 2_000,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      });
      try {
        await redis.connect();
        checks.redis = (await redis.ping()) === "PONG";
        checks.worker =
          (await redis.get("beta-erp-core:worker:heartbeat")) !== null;
      } finally {
        redis.disconnect();
      }
    } catch {
      throw new ServiceUnavailableException({
        status: "NOT_READY",
        checks,
        checkedAt: new Date().toISOString(),
      });
    }
    if (!checks.postgres || !checks.redis || !checks.worker) {
      throw new ServiceUnavailableException({
        status: "NOT_READY",
        checks,
        checkedAt: new Date().toISOString(),
      });
    }
    return {
      status: "READY",
      checks,
      checkedAt: new Date().toISOString(),
    };
  }
}
