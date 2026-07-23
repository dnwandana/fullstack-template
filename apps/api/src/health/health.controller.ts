import { Controller, Get, HttpCode, Res } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { Response as ExResponse } from "express"
import { HealthService } from "./health.service"

@Controller("health")
@SkipThrottle({ general: true })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  async get(@Res({ passthrough: true }) res: ExResponse) {
    const { healthy, dbStatus } = await this.health.check()
    const isProd = process.env.NODE_ENV === "production"
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
