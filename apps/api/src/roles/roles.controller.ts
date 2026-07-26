import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common"
import { RolesService } from "./roles.service"
import { CreateRoleDto } from "./dto/create-role.dto"
import { UpdateRoleDto } from "./dto/update-role.dto"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgScoped } from "../tenancy/scoped.decorators"

@Controller("orgs/:org_id/roles")
@OrgScoped()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission("org:read")
  async list(@CurrentOrg() org: { id: string }) {
    return { message: "OK", data: await this.roles.findByOrg(org.id) }
  }

  @Post()
  @RequirePermission("org:manage_roles")
  async create(@CurrentOrg() org: { id: string }, @Body() dto: CreateRoleDto) {
    return { message: "Created", data: await this.roles.create(org.id, dto) }
  }

  @Get(":role_id")
  @RequirePermission("org:read")
  async read(@CurrentOrg() org: { id: string }, @Param("role_id", ParseUUIDPipe) roleId: string) {
    return { message: "OK", data: await this.roles.findOne(org.id, roleId) }
  }

  @Put(":role_id")
  @RequirePermission("org:manage_roles")
  async update(
    @CurrentOrg() org: { id: string },
    @Param("role_id", ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return { message: "OK", data: await this.roles.update(org.id, roleId, dto) }
  }

  @Delete(":role_id")
  @RequirePermission("org:manage_roles")
  async remove(@CurrentOrg() org: { id: string }, @Param("role_id", ParseUUIDPipe) roleId: string) {
    await this.roles.remove(org.id, roleId)
    return { message: "OK", data: null }
  }
}
