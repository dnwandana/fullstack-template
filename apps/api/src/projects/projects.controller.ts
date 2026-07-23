import { Body, Controller, Delete, Get, Post, Put, UseGuards } from "@nestjs/common"
import { ProjectsService } from "./projects.service"
import { ProjectBodyDto } from "./dto/project-body.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgGuard } from "../tenancy/org.guard"
import { ProjectGuard } from "../tenancy/project.guard"
import { PermissionsGuard } from "../tenancy/permissions.guard"

const ADMIN_ROLES = new Set(["owner", "admin"])

@Controller("orgs/:org_id/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("project:read")
  async list(
    @CurrentUser("id") userId: string,
    @CurrentOrg() org: { id: string; role_name: string },
  ) {
    const data = ADMIN_ROLES.has(org.role_name)
      ? await this.projects.findManyByOrgId(org.id)
      : await this.projects.findManyByUserId(org.id, userId)
    return { message: "OK", data }
  }

  @Post()
  @UseGuards(OrgGuard, PermissionsGuard)
  @RequirePermission("project:create")
  async create(
    @CurrentUser("id") userId: string,
    @CurrentOrg() org: { id: string },
    @Body() dto: ProjectBodyDto,
  ) {
    return { message: "Created", data: await this.projects.create(org.id, userId, dto) }
  }

  @Get(":project_id")
  @UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
  @RequirePermission("project:read")
  async read(@CurrentProject() project: { id: string }) {
    return { message: "OK", data: await this.projects.findById(project.id) }
  }

  @Put(":project_id")
  @UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
  @RequirePermission("project:update")
  async update(@CurrentProject() project: { id: string }, @Body() dto: ProjectBodyDto) {
    return { message: "OK", data: await this.projects.update(project.id, dto) }
  }

  @Delete(":project_id")
  @UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
  @RequirePermission("project:delete")
  async remove(@CurrentProject() project: { id: string }) {
    await this.projects.remove(project.id)
    return { message: "OK", data: null }
  }
}
