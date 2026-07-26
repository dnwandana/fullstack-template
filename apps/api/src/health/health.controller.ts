import { Controller, Get, HttpCode, Res } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { SkipThrottle } from "@nestjs/throttler"
import { Response as ExResponse } from "express"
import { HealthService } from "./health.service"
import { Public } from "../common/decorators/public.decorator"

@Controller("health")
@SkipThrottle({ general: true })
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly config: ConfigService,
  ) {}

  // Liveness: is the process running and able to answer? Deliberately does NOT touch
  // the database — an unreachable DB is a reason to stop routing traffic here, not a
  // reason for the orchestrator to kill and restart the container.
  @Get("live")
  @HttpCode(200)
  live() {
    return {
      message: "alive",
      data: { status: "alive", timestamp: new Date().toISOString() },
    }
  }

  // Readiness: should this instance receive traffic? Consults the database, so a DB
  // outage drops the instance from the load-balancer pool without restarting it.
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: ExResponse) {
    const { healthy, dbStatus } = await this.health.check()
    res.status(healthy ? 200 : 503)
    const data: Record<string, unknown> = {
      status: healthy ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
    }
    if (this.config.get<string>("NODE_ENV") !== "production") {
      data.uptime = process.uptime()
      data.database = dbStatus
    }
    return { message: healthy ? "ready" : "not_ready", data }
  }

  @Get()
  @HttpCode(200)
  async get(@Res({ passthrough: true }) res: ExResponse) {
    const { healthy, dbStatus } = await this.health.check()
    const isProd = this.config.get<string>("NODE_ENV") === "production"
    const status = healthy ? "healthy" : "unhealthy"

    res.status(healthy ? 200 : 503)

    const data: Record<string, unknown> = {
      status,
      timestamp: new Date().toISOString(),
    }
    if (!isProd) {
      data.uptime = process.uptime()
      data.database = dbStatus
    }
    return { message: status, data }
  }
}
