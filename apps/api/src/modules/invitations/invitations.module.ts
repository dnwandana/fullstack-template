import { Module } from "@nestjs/common"
import { InvitationsService } from "./invitations.service"
import { InvitationsController } from "./invitations.controller"
import { InvitationNotifierService } from "./invitation-notifier.service"
import { TenancyModule } from "@tenancy/tenancy.module"
import { OrgsModule } from "@modules/orgs/orgs.module"
import { UsersModule } from "@modules/users/users.module"
import { SharedModule } from "@shared/shared.module"

@Module({
  imports: [TenancyModule, OrgsModule, UsersModule, SharedModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationNotifierService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
