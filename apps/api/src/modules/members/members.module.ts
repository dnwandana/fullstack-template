import { Module } from "@nestjs/common"
import { MembersService } from "./members.service"
import { OrgMembersController } from "./org-members.controller"
import { ProjectMembersController } from "./project-members.controller"
import { TenancyModule } from "@tenancy/tenancy.module"
import { SharedModule } from "@shared/shared.module"

@Module({
  imports: [TenancyModule, SharedModule],
  controllers: [OrgMembersController, ProjectMembersController],
  providers: [MembersService],
})
export class MembersModule {}
