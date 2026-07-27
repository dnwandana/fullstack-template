import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Cron, CronExpression } from "@nestjs/schedule"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@core/database/prisma.service"

const DAY_MS = 86_400_000

// Retention is measured from expiresAt/revokedAt, never createdAt: a long-lived token that
// only expired yesterday must still survive its grace period. The grace period exists so
// "why was I logged out yesterday?" is still answerable from the table.
const REFRESH_GRACE_MS = 7 * DAY_MS
const RESET_GRACE_MS = 7 * DAY_MS
const INVITATION_GRACE_MS = 30 * DAY_MS

const LOCK_KEY = "auth-cleanup"

// Deletes run in bounded batches, each in its own short transaction. A single unbatched
// DELETE sized by the backlog is the failure mode this avoids: the first sweep against an
// aged deployment is exactly the one big enough to blow any transaction timeout, and a
// blown deadline yields P2028 with a full rollback — the backlog would never shrink.
// maxWait stays low: a replica that cannot even open a transaction should drop out and
// let tomorrow's run handle it.
const BATCH_SIZE = 10_000
const TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 }

export interface CleanupResult {
  refreshTokens: number
  resetTokens: number
  invitations: number
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    // Read through ConfigService so Joi's default ("true") applies when the var is unset.
    if (this.config.get<string>("CLEANUP_ENABLED") === "false") return
    try {
      const r = await this.run()
      this.logger.log(
        `Cleanup removed ${r.refreshTokens} refresh tokens, ` +
          `${r.resetTokens} reset tokens, ${r.invitations} invitations`,
      )
    } catch (err) {
      // @nestjs/schedule does not catch rejections from cron handlers, so without this the
      // job would fail as a bare unhandled rejection — no log line, nothing to alert on,
      // and the tables this exists to bound would grow forever with no visible signal.
      this.logger.error(
        `Cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      )
    }
  }

  async run(batchSize = BATCH_SIZE): Promise<CleanupResult> {
    const now = Date.now()
    const refreshCutoff = new Date(now - REFRESH_GRACE_MS)
    const resetCutoff = new Date(now - RESET_GRACE_MS)
    const invitationCutoff = new Date(now - INVITATION_GRACE_MS)

    // Raw SQL rather than deleteMany: Prisma cannot express DELETE … LIMIT, and the
    // bounded subquery is what caps each transaction. Every filter column is indexed
    // (see the expires_at/revoked_at indexes in schema.prisma), so a batch is an
    // index scan, not a sequential scan per iteration.
    const refreshTokens = await this.sweep(
      batchSize,
      (tx, limit) =>
        tx.$executeRaw`
          DELETE FROM refresh_tokens WHERE id IN (
            SELECT id FROM refresh_tokens
            WHERE expires_at < ${refreshCutoff} OR revoked_at < ${refreshCutoff}
            LIMIT ${limit})`,
    )
    const resetTokens = await this.sweep(
      batchSize,
      (tx, limit) =>
        tx.$executeRaw`
          DELETE FROM password_reset_tokens WHERE id IN (
            SELECT id FROM password_reset_tokens
            WHERE expires_at < ${resetCutoff}
            LIMIT ${limit})`,
    )
    const invitations = await this.sweep(
      batchSize,
      (tx, limit) =>
        tx.$executeRaw`
          DELETE FROM invitations WHERE id IN (
            SELECT id FROM invitations
            WHERE expires_at < ${invitationCutoff}
            LIMIT ${limit})`,
    )

    return { refreshTokens, resetTokens, invitations }
  }

  // Deletes in bounded batches until one comes up short. The advisory lock is re-taken
  // inside every batch transaction; losing it mid-sweep means another replica took over
  // the same garbage, so this one stops and reports what it already removed.
  private async sweep(
    batchSize: number,
    deleteBatch: (tx: Prisma.TransactionClient, limit: number) => Promise<number>,
  ): Promise<number> {
    let total = 0
    for (;;) {
      const deleted = await this.prisma.$transaction(async (tx) => {
        // Non-blocking on purpose: every replica fires this cron. The losers should give
        // up instantly, not queue and re-run the same sweep after the winner finishes.
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${LOCK_KEY})) AS locked`
        // `pg_try_advisory_xact_lock` is a scalar function, so this SELECT always
        // returns exactly one row. Zero rows would mean the query no longer says what
        // we think it says — and reading `locked` off `undefined` would then be a
        // falsy "lock not acquired", i.e. every replica silently stops sweeping and
        // expired rows accumulate forever with nothing in the logs.
        if (!row) throw new Error("Advisory lock probe returned no rows")
        if (!row.locked) return null
        return deleteBatch(tx, batchSize)
      }, TX_OPTIONS)

      if (deleted === null) {
        this.logger.debug("Cleanup skipped: another instance holds the lock")
        return total
      }
      total += deleted
      if (deleted < batchSize) return total
    }
  }
}
