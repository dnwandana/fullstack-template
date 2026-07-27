import { Injectable } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import type { Queue } from "bullmq"
import { NOTIFICATION_QUEUE } from "@core/queue/queue.constants"
import type { InvitationJob, NotificationJob } from "@core/queue/notification.job"

/**
 * Enqueue-only seam, like PasswordResetNotifierService: NotificationProcessor is where a real mail
 * provider gets wired in, off the request path, and where the log lines — including the dev-gated
 * accept URL — now live.
 */
@Injectable()
export class InvitationNotifierService {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>) {}

  /**
   * Queues the mail; resolving means enqueued, never delivered. `InvitationJob` mirrors these
   * params field for field, `orgName` included — the processor's log line still names it.
   */
  async sendInvitationEmail(params: {
    email: string
    invitationId: string
    rawToken: string
    orgName: string
  }): Promise<void> {
    await this.queue.add("invitation", {
      kind: "invitation",
      ...params,
    } satisfies InvitationJob)
  }
}
