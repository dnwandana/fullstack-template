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

// Bounded batches in short transactions cap WAL and lock time whatever the backlog: one
// unbatched DELETE sized by an aged deployment's first sweep blows the timeout, and its P2028
// rollback means the backlog never shrinks. Low maxWait drops a replica that cannot open a tx.
const BATCH_SIZE = 10_000
const TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 }

export interface CleanupResult {
  refreshTokens: number
  resetTokens: number
  invitations: number
  auditLogs: number
}

/**
 * Nightly pruner for expired refresh tokens, password-reset tokens, invitations, and
 * audit logs past their retention window.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Nightly 3am sweep. Nothing calls it, and the cron only fires when ScheduleModule.forRoot()
   * is registered. Returns immediately when CLEANUP_ENABLED is "false", and logs any failure
   * rather than rethrowing.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    // Read through ConfigService so Joi's default ("true") applies when the var is unset.
    if (this.config.get<string>("CLEANUP_ENABLED") === "false") return
    try {
      const r = await this.run()
      this.logger.log(
        `Cleanup removed ${r.refreshTokens} refresh tokens, ` +
          `${r.resetTokens} reset tokens, ${r.invitations} invitations, ` +
          `${r.auditLogs} audit logs`,
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

  /**
   * Deletes every row past its retention grace period and returns the per-table counts. Safe to
   * run while another replica sweeps: each batch takes a non-blocking advisory lock, so a
   * replica that loses it stops early and reports only what it removed.
   */
  async run(batchSize = BATCH_SIZE): Promise<CleanupResult> {
    const now = Date.now()
    const refreshCutoff = new Date(now - REFRESH_GRACE_MS)
    const resetCutoff = new Date(now - RESET_GRACE_MS)
    const invitationCutoff = new Date(now - INVITATION_GRACE_MS)
    // Read through ConfigService so Joi's default (90) applies when the var is unset.
    const auditRetentionDays = this.config.get<number>("AUDIT_RETENTION_DAYS", 90)
    const auditCutoff = new Date(now - auditRetentionDays * DAY_MS)

    // Raw SQL, not deleteMany: Prisma cannot express DELETE … LIMIT, and the bounded subquery
    // is what caps each transaction. Every filter column is indexed (the expires_at/revoked_at
    // indexes in schema.prisma), so a batch is an index scan, not a sequential scan per pass.
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

    // Accepted trade-off: this created_at-only scan has no dedicated index — both audit_logs
    // indexes lead with org_id. The nightly sweep on a single-VPS deployment tolerates a
    // sequential scan, and the spec defines only the two composite indexes.
    const auditLogs = await this.sweep(
      batchSize,
      (tx, limit) =>
        tx.$executeRaw`
          DELETE FROM audit_logs WHERE id IN (
            SELECT id FROM audit_logs
            WHERE created_at < ${auditCutoff}
            LIMIT ${limit})`,
    )

    return { refreshTokens, resetTokens, invitations, auditLogs }
  }

  // Batches until one comes up short. The lock is transaction-scoped, so it is released between
  // batches and two replicas may interleave batches of one sweep harmlessly — it prevents
  // duplicated work, not concurrent runs. Losing it mid-sweep stops this replica early.
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
        // `pg_try_advisory_xact_lock` is scalar, so this SELECT always returns one row. Zero
        // rows would read `locked` off `undefined` — a falsy "lock not acquired", i.e. every
        // replica silently stops sweeping and expired rows pile up with nothing in the logs.
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
