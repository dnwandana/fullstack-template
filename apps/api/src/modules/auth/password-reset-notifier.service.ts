import { Injectable } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import type { Queue } from "bullmq"
import { NOTIFICATION_QUEUE } from "@core/queue/queue.constants"
import type { NotificationJob, PasswordResetJob } from "@core/queue/notification.job"

/**
 * Enqueue-only seam; delivery must not sit on the request path. The logging and its PII rules
 * moved to NotificationProcessor — the always-on line names the user id, never the address, and
 * the reset URL is debug-only under NODE_ENV=development. That file is where a real mailer goes.
 */
@Injectable()
export class PasswordResetNotifierService {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>) {}

  /**
   * Rejects when the queue rejects, so a dropped job cannot be reported as a sent reset email.
   * `rawToken` is the raw token, not the stored hash.
   */
  async sendResetEmail(params: { email: string; rawToken: string; userId: string }): Promise<void> {
    await this.queue.add("password-reset", {
      kind: "password-reset",
      ...params,
    } satisfies PasswordResetJob)
  }
}
