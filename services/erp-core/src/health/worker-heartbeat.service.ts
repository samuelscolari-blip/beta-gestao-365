import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { loadConfig } from "../config/env";

const HEARTBEAT_KEY = "beta-erp-core:worker:heartbeat";

@Injectable()
export class WorkerHeartbeatService
  implements OnModuleInit, OnModuleDestroy
{
  private redis: Redis | null = null;
  private timer: NodeJS.Timeout | null = null;

  async onModuleInit() {
    this.redis = new Redis(loadConfig().redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
    });
    await this.beat();
    this.timer = setInterval(() => {
      void this.beat();
    }, 15_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.redis) {
      await this.redis.del(HEARTBEAT_KEY).catch(() => 0);
      this.redis.disconnect();
    }
  }

  private async beat() {
    await this.redis?.set(
      HEARTBEAT_KEY,
      new Date().toISOString(),
      "EX",
      45,
    );
  }
}
