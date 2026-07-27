import { Module } from "@nestjs/common"
import { MembershipService } from "./membership.service"
import { OrgGuard } from "./org.guard"
import { ProjectGuard } from "./project.guard"
import { PermissionsGuard } from "./permissions.guard"

@Module({
  providers: [MembershipService, OrgGuard, ProjectGuard, PermissionsGuard],
  exports: [MembershipService, OrgGuard, ProjectGuard, PermissionsGuard],
})
export class TenancyModule {}
