import { Controller, Get } from "@nestjs/common";
import { PublicRoute } from "../security/public-route";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @PublicRoute()
  @Get("live")
  live() {
    return {
      status: "UP",
      service: "beta-erp-core",
      checkedAt: new Date().toISOString(),
    };
  }

  @PublicRoute()
  @Get("ready")
  async ready() {
    return this.health.ready();
  }
}
