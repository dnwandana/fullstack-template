import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { buildInvitationAcceptUrl } from "./invitation-url"

@Injectable()
export class InvitationNotifierService {
  private readonly logger = new Logger(InvitationNotifierService.name)

  constructor(private readonly config: ConfigService) {}

  sendInvitationEmail(params: {
    email: string
    invitationId: string
    rawToken: string
    orgName: string
  }): void {
    this.logger.log(`Invitation email queued for ${params.email} (org: ${params.orgName})`)
    if (this.config.get<string>("NODE_ENV") === "development") {
      const base = this.config.get<string>("APP_BASE_URL") ?? ""
      this.logger.debug(
        `Accept URL: ${buildInvitationAcceptUrl(base, params.invitationId, params.rawToken)}`,
      )
    }
  }
}
