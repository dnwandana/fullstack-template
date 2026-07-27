import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Processor, WorkerHost } from "@nestjs/bullmq"
import { buildInvitationAcceptUrl } from "@modules/invitations/invitation-url"
import { NOTIFICATION_QUEUE } from "./queue.constants"
import type { NotificationJob } from "./notification.job"

// The delivery side of both notification seams. It holds the log statements that
// used to sit inline in PasswordResetNotifierService / InvitationNotifierService:
// those services now only enqueue, so this is the single place a real mail
// provider gets wired in, and it runs off the request path.
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(private readonly config: ConfigService) {
    super()
  }

  // The parameter is structurally the slice of bullmq's Job this handler reads.
  // Narrowing it here is what lets the spec construct a job as a plain object
  // instead of casting a full Job, and it keeps the handler a pure function of
  // its payload.
  async process(job: { data: NotificationJob }): Promise<void> {
    const data = job.data
    switch (data.kind) {
      case "password-reset": {
        // The address is PII — production logs identify the user by id, matching the
        // redaction posture of the request logger. The email stays in params because an
        // actual mail provider wired into this seam needs it.
        this.logger.log(`Password reset email queued for user ${data.userId}`)
        // The raw token is a bearer credential. Log it only in local development, never
        // in test or production — same rule as InvitationNotifierService.
        if (this.config.get<string>("NODE_ENV") === "development") {
          const base = this.config.get<string>("APP_BASE_URL") ?? ""
          this.logger.debug(`Reset URL: ${base}/reset-password?token=${data.rawToken}`)
        }
        return await Promise.resolve()
      }
      case "invitation": {
        this.logger.log(`Invitation email queued for ${data.email} (org: ${data.orgName})`)
        if (this.config.get<string>("NODE_ENV") === "development") {
          const base = this.config.get<string>("APP_BASE_URL") ?? ""
          this.logger.debug(
            `Accept URL: ${buildInvitationAcceptUrl(base, data.invitationId, data.rawToken)}`,
          )
        }
        return await Promise.resolve()
      }
      default: {
        // Adding a variant to NotificationJob without a case here is a compile
        // error, not a job that is acknowledged and silently never delivered.
        const _exhaustive: never = data
        throw new Error(`unhandled notification kind: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }
}
