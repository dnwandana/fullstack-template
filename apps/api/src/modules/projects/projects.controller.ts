import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common"
import { ProjectsService } from "./projects.service"
import { ProjectResponse } from "./dto/project.response"
import type { Payload } from "@shared/dto/response.types"
import { ProjectBodyDto } from "./dto/project-body.dto"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { CurrentPermissions } from "@shared/decorators/current-permissions.decorator"
import { CurrentProject } from "@shared/decorators/current-project.decorator"
import { OrgScoped, ProjectScoped } from "@tenancy/scoped.decorators"

/** Org-scoped project CRUD; `list` is the only route whose visible set varies by permission. */
@Controller("orgs/:org_id/projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // Every project in the org when the caller holds `project:read_all`, otherwise only the ones
  // they belong to. Visibility keys off the permission, never a role name — a custom role
  // granted it behaves like owner/admin. Do not reintroduce the old `ADMIN_ROLES` check.
  @Get()
  @OrgScoped("project:read")
  async list(
    @CurrentUser("id") userId: string,
    @CurrentOrg() org: { id: string },
    @CurrentPermissions() permissions: string[],
  ): Promise<Payload<ProjectResponse[]>> {
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
  ): Promise<Payload<ProjectResponse>> {
    return { message: "Created", data: await this.projects.create(org.id, userId, dto) }
  }

  @Get(":project_id")
  @ProjectScoped("project:read")
  async read(@CurrentProject() project: { id: string }): Promise<Payload<ProjectResponse | null>> {
    return { message: "OK", data: await this.projects.findById(project.id) }
  }

  @Put(":project_id")
  @ProjectScoped("project:update")
  async update(
    @CurrentProject() project: { id: string },
    @Body() dto: ProjectBodyDto,
  ): Promise<Payload<ProjectResponse>> {
    return { message: "OK", data: await this.projects.update(project.id, dto) }
  }

  @Delete(":project_id")
  @ProjectScoped("project:delete")
  async remove(@CurrentProject() project: { id: string }): Promise<Payload<null>> {
    await this.projects.remove(project.id)
    return { message: "OK", data: null }
  }
}
