import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class PasswordResetNotifierService {
  private readonly logger = new Logger(PasswordResetNotifierService.name)

  constructor(private readonly config: ConfigService) {}

  sendResetEmail(params: { email: string; rawToken: string; userId: string }): void {
    // The address is PII — production logs identify the user by id, matching the
    // redaction posture of the request logger. The email stays in params because an
    // actual mail provider wired into this seam needs it.
    this.logger.log(`Password reset email queued for user ${params.userId}`)
    // The raw token is a bearer credential. Log it only in local development, never
    // in test or production — same rule as InvitationNotifierService.
    if (this.config.get<string>("NODE_ENV") === "development") {
      const base = this.config.get<string>("APP_BASE_URL") ?? ""
      this.logger.debug(`Reset URL: ${base}/reset-password?token=${params.rawToken}`)
    }
  }
}
