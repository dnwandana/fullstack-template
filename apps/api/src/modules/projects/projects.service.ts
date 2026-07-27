import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { ProjectBodyDto } from "./dto/project-body.dto"
import { PROJECT_SELECT } from "./project-row"
import { ProjectResponse, toProjectResponse } from "./dto/project.response"

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByOrgId(orgId: string): Promise<ProjectResponse[]> {
    const rows = await this.prisma.project.findMany({
      where: { orgId },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toProjectResponse(row))
  }

  async findManyByUserId(orgId: string, userId: string): Promise<ProjectResponse[]> {
    const rows = await this.prisma.project.findMany({
      where: { orgId, projectMembers: { some: { userId } } },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toProjectResponse(row))
  }

  async create(orgId: string, userId: string, dto: ProjectBodyDto): Promise<ProjectResponse> {
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          id: randomUUID(),
          orgId,
          name: dto.name,
          description: dto.description ?? null,
          createdBy: userId,
        },
        select: PROJECT_SELECT,
      })
      // Add the creator as a project member with their org-level role.
      const orgMembership = await tx.orgMember.findUnique({
        where: { userId_orgId: { userId, orgId } },
        select: { roleId: true },
      })
      if (orgMembership) {
        await tx.projectMember.create({
          data: { projectId: created.id, userId, roleId: orgMembership.roleId },
        })
      }
      return created
    })
    return toProjectResponse(project)
  }

  async findById(projectId: string): Promise<ProjectResponse | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: PROJECT_SELECT,
    })
    return project ? toProjectResponse(project) : null
  }

  async update(projectId: string, dto: ProjectBodyDto): Promise<ProjectResponse> {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name, description: dto.description ?? null },
      select: PROJECT_SELECT,
    })
    return toProjectResponse(project)
  }

  async remove(projectId: string): Promise<void> {
    await this.prisma.project.deleteMany({ where: { id: projectId } })
  }
}
