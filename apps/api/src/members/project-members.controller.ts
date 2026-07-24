import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common"
import { MembersService } from "./members.service"
import { UpdateMemberDto } from "./dto/update-member.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { CurrentPermissions } from "../common/decorators/current-permissions.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgGuard } from "../tenancy/org.guard"
import { ProjectGuard } from "../tenancy/project.guard"
import { PermissionsGuard } from "../tenancy/permissions.guard"

@Controller("orgs/:org_id/projects/:project_id/members")
@UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
export class ProjectMembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermission("project:read")
  async list(@CurrentProject() project: { id: string }) {
    return { message: "OK", data: await this.members.listProjectMembers(project.id) }
  }

  @Put(":user_id")
  @RequirePermission("project:manage_members")
  async update(
    @CurrentOrg() org: { id: string },
    @CurrentProject() project: { id: string },
    @CurrentUser("id") actingUserId: string,
    @CurrentPermissions() actorPermissions: string[],
    @Param("user_id", ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    await this.members.updateProjectMemberRole(
      org.id,
      project.id,
      actingUserId,
      targetUserId,
      dto.role_id,
      actorPermissions,
    )
    return { message: "OK", data: null }
  }

  @Delete(":user_id")
  @RequirePermission("project:manage_members")
  async remove(
    @CurrentProject() project: { id: string },
    @CurrentUser("id") actingUserId: string,
    @Param("user_id", ParseUUIDPipe) targetUserId: string,
  ) {
    await this.members.removeProjectMember(project.id, actingUserId, targetUserId)
    return { message: "OK", data: null }
  }
}
