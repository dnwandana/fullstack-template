import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common"
import { RolesService } from "./roles.service"
import { CreateRoleDto } from "./dto/create-role.dto"
import { UpdateRoleDto } from "./dto/update-role.dto"
import { RoleResponse } from "./dto/role.response"
import type { Payload } from "@shared/dto/response.types"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { OrgScoped } from "@tenancy/scoped.decorators"

/** Custom role CRUD. Reads need `org:read`; every write needs `org:manage_roles`. */
@Controller("orgs/:org_id/roles")
@OrgScoped()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  // Every role in the org, system and custom alike, each with its permissions.
  @Get()
  @RequirePermission("org:read")
  async list(@CurrentOrg() org: { id: string }): Promise<Payload<RoleResponse[]>> {
    return { message: "OK", data: await this.roles.findByOrg(org.id) }
  }

  // `400` on a duplicate name or an unknown permission id.
  @Post()
  @RequirePermission("org:manage_roles")
  async create(
    @CurrentOrg() org: { id: string },
    @Body() dto: CreateRoleDto,
  ): Promise<Payload<RoleResponse>> {
    return { message: "Created", data: await this.roles.create(org.id, dto) }
  }

  // `404` when the role belongs to another org, so ids cannot be probed across orgs.
  @Get(":role_id")
  @RequirePermission("org:read")
  async read(
    @CurrentOrg() org: { id: string },
    @Param("role_id", ParseUUIDPipe) roleId: string,
  ): Promise<Payload<RoleResponse>> {
    return { message: "OK", data: await this.roles.findOne(org.id, roleId) }
  }

  // `400` for a system role. `permission_ids` replaces the grants outright.
  @Put(":role_id")
  @RequirePermission("org:manage_roles")
  async update(
    @CurrentOrg() org: { id: string },
    @Param("role_id", ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<Payload<RoleResponse>> {
    return { message: "OK", data: await this.roles.update(org.id, roleId, dto) }
  }

  // `400` for a system role or one still assigned to an org or project member.
  @Delete(":role_id")
  @RequirePermission("org:manage_roles")
  async remove(
    @CurrentOrg() org: { id: string },
    @Param("role_id", ParseUUIDPipe) roleId: string,
  ): Promise<Payload<null>> {
    await this.roles.remove(org.id, roleId)
    return { message: "OK", data: null }
  }
}
