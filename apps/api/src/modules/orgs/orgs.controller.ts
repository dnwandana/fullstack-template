import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common"
import { OrgsService } from "./orgs.service"
import { OrgResponse } from "./dto/org.response"
import type { Payload } from "@shared/dto/response.types"
import { OrgBodyDto } from "./dto/org-body.dto"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { OrgScoped } from "@tenancy/scoped.decorators"

@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  async create(
    @CurrentUser("id") userId: string,
    @Body() dto: OrgBodyDto,
  ): Promise<Payload<OrgResponse>> {
    const data = await this.orgs.createWithSystemRoles(userId, dto)
    return { message: "Created", data }
  }

  @Get()
  async list(@CurrentUser("id") userId: string): Promise<Payload<OrgResponse[]>> {
    const data = await this.orgs.findManyByUserId(userId)
    return { message: "OK", data }
  }

  @Get(":org_id")
  @OrgScoped("org:read")
  async read(@CurrentOrg() org: { id: string }): Promise<Payload<OrgResponse | null>> {
    const data = await this.orgs.findById(org.id)
    return { message: "OK", data }
  }

  @Put(":org_id")
  @OrgScoped("org:update")
  async update(
    @CurrentOrg() org: { id: string },
    @Body() dto: OrgBodyDto,
  ): Promise<Payload<OrgResponse>> {
    const data = await this.orgs.update(org.id, dto)
    return { message: "OK", data }
  }

  @Delete(":org_id")
  @OrgScoped("org:delete")
  async remove(@CurrentOrg() org: { id: string }): Promise<Payload<null>> {
    await this.orgs.remove(org.id)
    return { message: "OK", data: null }
  }
}
