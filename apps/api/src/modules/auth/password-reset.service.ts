import { BadRequestException, Injectable } from "@nestjs/common"
import { createHash, randomBytes, randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { PasswordService } from "./password.service"
import { PasswordResetNotifierService } from "./password-reset-notifier.service"

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * Issues and consumes password-reset tokens. Only the SHA-256 hash of the 64-hex token is stored,
 * so a leaked database row cannot be turned back into a working reset link.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly notifier: PasswordResetNotifierService,
  ) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex")
  }

  /** Issues a 1-hour token and hands it to the notifier; an unknown address is a silent no-op. */
  async issue(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    // Unknown address: do nothing at all. The caller replies identically either way,
    // so the endpoint cannot be used to enumerate registered emails.
    if (!user) return

    const rawToken = randomBytes(32).toString("hex")
    // The newest link is the only valid link: voiding every outstanding token first also disarms
    // any earlier one still sitting in an inbox.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    // `id` has no database default on password_reset_tokens (unlike refresh_tokens).
    await this.prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.hash(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })
    // Awaited, not fire-and-forget: an unawaited rejection is a user who never receives a reset
    // email and a request that reported success.
    await this.notifier.sendResetEmail({ email, rawToken, userId: user.id })
  }

  /**
   * Claims the token atomically; 0 rows updated — unknown, already used, or expired — is a `400`.
   * Success is a full credential rotation: it clears the lockout counters and revokes every
   * refresh token and every other outstanding reset token for that user.
   */
  async consume(rawToken: string, newPassword: string): Promise<void> {
    // Argon2 takes tens of ms — hash before opening the transaction, not while holding a row lock.
    const passwordHash = await this.passwords.hash(newPassword)
    const tokenHash = this.hash(rawToken)

    await this.prisma.$transaction(async (tx) => {
      // Claim first, requiring usedAt still null: tokenHash is unique, so a concurrent second
      // call updates zero rows and is rejected. A read-then-write check here would be racy.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (claimed.count === 0) throw new BadRequestException("Invalid or expired reset token")

      const row = await tx.passwordResetToken.findUniqueOrThrow({
        where: { tokenHash },
        select: { userId: true },
      })

      await tx.user.update({
        where: { id: row.userId },
        data: { password: passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      })
      // Every other outstanding reset token dies too: one requested earlier (by an attacker with
      // transient mailbox access, say) must not survive the victim's reset.
      await tx.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await tx.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      })
    })
  }
}
