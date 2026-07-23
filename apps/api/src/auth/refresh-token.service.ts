import { Injectable } from "@nestjs/common"
import { createHash, randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"

const DURATION_MS: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex")
  }

  async persist(userId: string, raw: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { id: randomUUID(), userId, tokenHash: this.hashToken(raw), expiresAt },
    })
  }

  async findActive(raw: string): Promise<{ id: string; userId: string; expiresAt: Date } | null> {
    const row = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      select: { id: true, userId: true, expiresAt: true },
    })
    return row
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } })
  }

  expiryFromDuration(duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return new Date(Date.now() + 7 * 86400000)
    return new Date(Date.now() + parseInt(match[1], 10) * DURATION_MS[match[2]])
  }
}
