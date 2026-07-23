import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { ProjectBodyDto } from "./dto/project-body.dto"

const PROJECT_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const

type ProjectRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// API responses keep the Express-era snake_case contract the SPA consumes.
const toSnake = (project: ProjectRow) => ({
  id: project.id,
  org_id: project.orgId,
  name: project.name,
  description: project.description,
  created_by: project.createdBy,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
})

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByOrgId(orgId: string) {
    const rows = await this.prisma.project.findMany({
      where: { orgId },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map(toSnake)
  }

  async findManyByUserId(orgId: string, userId: string) {
    const rows = await this.prisma.project.findMany({
      where: { orgId, projectMembers: { some: { userId } } },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map(toSnake)
  }

  async create(orgId: string, userId: string, dto: ProjectBodyDto) {
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
    return toSnake(project)
  }

  async findById(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: PROJECT_SELECT,
    })
    return project ? toSnake(project) : null
  }

  async update(projectId: string, dto: ProjectBodyDto) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name, description: dto.description ?? null },
      select: PROJECT_SELECT,
    })
    return toSnake(project)
  }

  async remove(projectId: string): Promise<void> {
    await this.prisma.project.deleteMany({ where: { id: projectId } })
  }
}
