import { Body, Controller, Delete, Get, Post, Put, UseGuards } from "@nestjs/common"
import { OrgsService } from "./orgs.service"
import { OrgBodyDto } from "./dto/org-body.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgGuard } from "../tenancy/org.guard"
import { PermissionsGuard } from "../tenancy/permissions.guard"

@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  async create(@CurrentUser("id") userId: string, @Body() dto: OrgBodyDto) {
    const data = await this.orgs.createWithSystemRoles(userId, dto)
    return { message: "Created", data }
  }

  @Get()
  async list(@CurrentUser("id") userId: string) {
    const data = await this.orgs.findManyByUserId(userId)
    return { message: "OK", data }
  }

  @Get(":org_id")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("org:read")
  async read(@CurrentOrg() org: { id: string }) {
    const data = await this.orgs.findById(org.id)
    return { message: "OK", data }
  }

  @Put(":org_id")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("org:update")
  async update(@CurrentOrg() org: { id: string }, @Body() dto: OrgBodyDto) {
    const data = await this.orgs.update(org.id, dto)
    return { message: "OK", data }
  }

  @Delete(":org_id")
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("org:delete")
  async remove(@CurrentOrg() org: { id: string }) {
    await this.orgs.remove(org.id)
    return { message: "OK", data: null }
  }
}
