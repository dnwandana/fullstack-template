import { Injectable } from "@nestjs/common"
import { createHash, randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { parseDuration } from "../common/duration"

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

  // Unlike findActive, this does NOT filter on revokedAt: the caller needs to tell
  // "never existed" (forgery) apart from "existed and was rotated" (replay).
  async findByToken(
    raw: string,
  ): Promise<{ id: string; userId: string; expiresAt: Date; revokedAt: Date | null } | null> {
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash: this.hashToken(raw) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    })
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } })
  }

  // Atomic claim for rotation: revokedAt is set only if still null, so exactly one of
  // N concurrent presenters of the same token wins. A read-check-revoke sequence here
  // would let a racing replay slip past reuse detection entirely.
  // Losers are treated as reuse and revoke the whole family, so clients must serialize
  // their refreshes — the SPA does (single-flight queue in apps/app/src/utils/http.js).
  async claimForRotation(id: string): Promise<boolean> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return res.count === 1
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  expiryFromDuration(duration: string): Date {
    // parseDuration returns milliseconds and throws on a bad value — no silent 7-day
    // fallback, which used to let the DB row disagree with the JWT.
    return new Date(Date.now() + parseDuration(duration))
  }
}
