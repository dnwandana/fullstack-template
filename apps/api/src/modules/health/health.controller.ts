import { Controller, Get, HttpCode, Res, VERSION_NEUTRAL } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { SkipThrottle } from "@nestjs/throttler"
import { Response as ExResponse } from "express"
import { HealthService } from "./health.service"
import { Public } from "@shared/decorators/public.decorator"

// VERSION_NEUTRAL keeps these probes off /v1 — enableVersioning ignores setGlobalPrefix's
// `exclude`, so without it /v1/health* silently breaks the container healthchecks and nginx
// locations. It must sit in @Controller's options; @Version is MethodDecorator-only in Nest 11.

/**
 * Container and orchestrator probes. The class-level @Public() and @SkipThrottle are
 * load-bearing: these routes must answer while unauthenticated and must never be rate-limited.
 */
@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle({ general: true })
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly config: ConfigService,
  ) {}

  // Liveness: is the process running and able to answer? Deliberately touches NO dependency —
  // an unreachable database is a reason to stop routing traffic here, not a reason for the
  // orchestrator to kill and restart a healthy process.
  @Get("live")
  @HttpCode(200)
  live() {
    return {
      message: "alive",
      data: { status: "alive", timestamp: new Date().toISOString() },
    }
  }

  // Readiness: should this instance receive traffic? Probes the database only — a DB outage
  // drops the instance from the load-balancer pool without restarting it, while an instance
  // whose Redis is unreachable still reports ready. Uptime and db detail are dev-only.
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

  // Aggregate probe: the same database check as `ready`, reported as healthy/unhealthy.
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
