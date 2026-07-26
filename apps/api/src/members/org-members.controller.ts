import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from "@nestjs/common"
import { MembersService } from "./members.service"
import { UpdateMemberDto } from "./dto/update-member.dto"
import { ListQueryDto } from "../common/pagination/list-query.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { CurrentPermissions } from "../common/decorators/current-permissions.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgScoped } from "../tenancy/scoped.decorators"

@Controller("orgs/:org_id/members")
@OrgScoped()
export class OrgMembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermission("org:read")
  async list(@CurrentOrg() org: { id: string }, @Query() query: ListQueryDto) {
    return { message: "OK", ...(await this.members.listOrgMembers(org.id, query)) }
  }

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
