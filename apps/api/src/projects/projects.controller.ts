import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common"
import { ProjectsService } from "./projects.service"
import { ProjectBodyDto } from "./dto/project-body.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentOrg } from "../common/decorators/current-org.decorator"
import { CurrentPermissions } from "../common/decorators/current-permissions.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { OrgScoped, ProjectScoped } from "../tenancy/scoped.decorators"

@Controller("orgs/:org_id/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @OrgScoped("project:read")
  async list(
    @CurrentUser("id") userId: string,
    @CurrentOrg() org: { id: string },
    @CurrentPermissions() permissions: string[],
  ) {
    // Visibility keys off a permission, not a role name: a custom role granted
    // project:read_all sees the whole org, exactly like owner/admin do.
    const data = permissions.includes("project:read_all")
      ? await this.projects.findManyByOrgId(org.id)
      : await this.projects.findManyByUserId(org.id, userId)
    return { message: "OK", data }
  }

  @Post()
  @OrgScoped("project:create")
  async create(
    @CurrentUser("id") userId: string,
    @CurrentOrg() org: { id: string },
    @Body() dto: ProjectBodyDto,
  ) {
    return { message: "Created", data: await this.projects.create(org.id, userId, dto) }
  }

  @Get(":project_id")
  @ProjectScoped("project:read")
  async read(@CurrentProject() project: { id: string }) {
    return { message: "OK", data: await this.projects.findById(project.id) }
  }

  @Put(":project_id")
  @ProjectScoped("project:update")
  async update(@CurrentProject() project: { id: string }, @Body() dto: ProjectBodyDto) {
    return { message: "OK", data: await this.projects.update(project.id, dto) }
  }

  @Delete(":project_id")
  @ProjectScoped("project:delete")
  async remove(@CurrentProject() project: { id: string }) {
    await this.projects.remove(project.id)
    return { message: "OK", data: null }
  }
}
