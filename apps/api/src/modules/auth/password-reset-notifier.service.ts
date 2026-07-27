import { Injectable } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import type { Queue } from "bullmq"
import { NOTIFICATION_QUEUE } from "@core/queue/queue.constants"
import type { NotificationJob, PasswordResetJob } from "@core/queue/notification.job"

// The seam is now enqueue-only. Everything that used to be logged here — and the
// PII and bearer-credential rules that governed it — moved to NotificationProcessor,
// which is where a real mail provider goes. Delivery must not be on the request path.
@Injectable()
export class PasswordResetNotifierService {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJob>) {}

  async sendResetEmail(params: { email: string; rawToken: string; userId: string }): Promise<void> {
    await this.queue.add("password-reset", {
      kind: "password-reset",
      ...params,
    } satisfies PasswordResetJob)
  }
}
