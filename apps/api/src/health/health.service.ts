import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ healthy: boolean; dbStatus: "ok" | "error" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { healthy: true, dbStatus: "ok" }
    } catch {
      return { healthy: false, dbStatus: "error" }
    }
  }
}
