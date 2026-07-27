import { Injectable } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import type { Queue } from "bullmq"
import { NOTIFICATION_QUEUE } from "@core/queue/queue.constants"
import type { InvitationJob, NotificationJob } from "@core/queue/notification.job"

// Enqueue-only, like PasswordResetNotifierService. The log lines — including the
// dev-gated accept URL — live in NotificationProcessor now.
@Injectable()
export class InvitationNotifierService {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>) {}

  // The parameter list is unchanged, and InvitationJob mirrors it field for field —
  // in particular `orgName`, which the processor's log line still names.
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
