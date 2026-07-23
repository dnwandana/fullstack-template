import { Module } from "@nestjs/common"
import { InvitationsService } from "./invitations.service"
import { InvitationsController } from "./invitations.controller"
import { InvitationNotifierService } from "./invitation-notifier.service"
import { TenancyModule } from "../tenancy/tenancy.module"
import { OrgsModule } from "../orgs/orgs.module"
import { UsersModule } from "../users/users.module"

@Module({
  imports: [TenancyModule, OrgsModule, UsersModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationNotifierService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
