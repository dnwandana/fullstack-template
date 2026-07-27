import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from "@nestjs/common"
import { MembersService } from "./members.service"
import { UpdateMemberDto } from "./dto/update-member.dto"
import { ListQueryDto } from "@shared/pagination/list-query.dto"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { CurrentPermissions } from "@shared/decorators/current-permissions.decorator"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { OrgScoped } from "@tenancy/scoped.decorators"

/** Org membership routes; `@OrgScoped()` puts OrgGuard then PermissionsGuard in front of each. */
@Controller("orgs/:org_id/members")
@OrgScoped()
export class OrgMembersController {
  constructor(private readonly members: MembersService) {}

  // Spreads the service's `{ data, pagination }` into the envelope; `limit` defaults to 50.
  @Get()
  @RequirePermission("org:read")
  async list(@CurrentOrg() org: { id: string }, @Query() query: ListQueryDto) {
    return { message: "OK", ...(await this.members.listOrgMembers(org.id, query)) }
  }

  // 403 unless an owner touches the owner role, 400 on a self-change or the last owner.
  @Put(":user_id")
  @RequirePermission("org:manage_members")
  async update(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") actingUserId: string,
    @CurrentPermissions() actorPermissions: string[],
    @Param("user_id", ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const data = await this.members.updateOrgMemberRole(
      org.id,
      actingUserId,
      targetUserId,
      dto.role_id,
      actorPermissions,
    )
    return { message: "OK", data }
  }

  // 403 unless an owner removes an owner, 400 on self-removal or the last owner.
  @Delete(":user_id")
  @RequirePermission("org:manage_members")
  async remove(
    @CurrentOrg() org: { id: string },
    @CurrentUser("id") actingUserId: string,
    @Param("user_id", ParseUUIDPipe) targetUserId: string,
  ) {
    await this.members.removeOrgMember(org.id, actingUserId, targetUserId)
    return { message: "OK", data: null }
  }
}
