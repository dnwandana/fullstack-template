import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from "@nestjs/common"
import { MembersService } from "./members.service"
import { UpdateMemberDto } from "./dto/update-member.dto"
import { ListQueryDto } from "@shared/pagination/list-query.dto"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { CurrentProject } from "@shared/decorators/current-project.decorator"
import { CurrentPermissions } from "@shared/decorators/current-permissions.decorator"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { ProjectScoped } from "@tenancy/scoped.decorators"

/** Project membership routes; `@ProjectScoped()` runs OrgGuard, ProjectGuard, PermissionsGuard. */
@Controller("orgs/:org_id/projects/:project_id/members")
@ProjectScoped()
export class ProjectMembersController {
  constructor(private readonly members: MembersService) {}

  // Spreads the service's `{ data, pagination }` into the envelope; `limit` defaults to 50.
  @Get()
  @RequirePermission("project:read")
  async list(@CurrentProject() project: { id: string }, @Query() query: ListQueryDto) {
    return { message: "OK", ...(await this.members.listProjectMembers(project.id, query)) }
  }

  // 400 for the owner role — owner is org-level and never assignable at project scope.
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
    const data = await this.members.updateProjectMemberRole(
      org.id,
      project.id,
      actingUserId,
      targetUserId,
      dto.role_id,
      actorPermissions,
    )
    return { message: "OK", data }
  }

  @Delete(":user_id")
  @RequirePermission("project:manage_members")
  async remove(
    @CurrentOrg() org: { id: string },
    @CurrentProject() project: { id: string },
    @CurrentUser("id") actingUserId: string,
    @Param("user_id", ParseUUIDPipe) targetUserId: string,
  ) {
    await this.members.removeProjectMember(org.id, project.id, actingUserId, targetUserId)
    return { message: "OK", data: null }
  }
}
