import { Injectable } from "@nestjs/common"
import { createHash, randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { parseDuration } from "@shared/utils/duration"

/** Stores refresh tokens as SHA-256 hashes and owns the atomic claim that rotation depends on. */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Deterministic, so a raw token can be looked up by hash; the raw token is never stored. */
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

  /**
   * Unlike `findActive`, this deliberately does NOT filter on `revokedAt` — that is what lets the
   * caller tell "never existed" (forgery) from "existed and was rotated" (replay), and so is what
   * makes reuse detection possible at all. Do not add the filter.
   */
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

  /**
   * Sets `revokedAt` only where still null, so exactly one of N concurrent presenters of a token
   * wins; read-check-revoke would let a racing replay slip past reuse detection. Losers count as
   * reuse and kill the family, so clients must serialize (apps/app/src/utils/http.js does).
   */
  async claimForRotation(id: string): Promise<boolean> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return res.count === 1
  }

  /** The reuse response: logs out every device, including sessions the presenter never touched. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  expiryFromDuration(duration: string): Date {
    // parseDuration throws on a bad value — no silent 7-day fallback, which used to let the DB
    // row disagree with the JWT.
    return new Date(Date.now() + parseDuration(duration))
  }
}
