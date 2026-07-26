import { Module } from "@nestjs/common"
import { MembersService } from "./members.service"
import { OrgMembersController } from "./org-members.controller"
import { ProjectMembersController } from "./project-members.controller"
import { TenancyModule } from "../tenancy/tenancy.module"
import { PaginationService } from "../common/pagination/pagination.service"

@Module({
  imports: [TenancyModule],
  controllers: [OrgMembersController, ProjectMembersController],
  providers: [MembersService, PaginationService],
})
export class MembersModule {}
