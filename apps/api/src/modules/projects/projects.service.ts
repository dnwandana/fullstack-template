import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { ProjectBodyDto } from "./dto/project-body.dto"
import { PROJECT_SELECT } from "./project-row"
import { ProjectResponse, toProjectResponse } from "./dto/project.response"

/**
 * Project CRUD. Which of the two list methods to call is the caller's decision: it turns on
 * `project:read_all`, which only the request context knows.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every project in the org — the caller must have confirmed `project:read_all` first. */
  async findManyByOrgId(orgId: string): Promise<ProjectResponse[]> {
    const rows = await this.prisma.project.findMany({
      where: { orgId },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toProjectResponse(row))
  }

  /** Only the projects this user is a member of, which is the default visibility. */
  async findManyByUserId(orgId: string, userId: string): Promise<ProjectResponse[]> {
    const rows = await this.prisma.project.findMany({
      where: { orgId, projectMembers: { some: { userId } } },
      select: PROJECT_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toProjectResponse(row))
  }

  /**
   * Also adds the creator as a project member, in the same transaction, carrying their org-level
   * role across. A creator with no org membership gets the project but no membership row.
   */
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
      // Creator joins with their org-level role; no org membership means no project row.
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

  /** Full replace: a `description` omitted from the body is written back as null. */
  async update(projectId: string, dto: ProjectBodyDto): Promise<ProjectResponse> {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name, description: dto.description ?? null },
      select: PROJECT_SELECT,
    })
    return toProjectResponse(project)
  }

  /** Uses `deleteMany`, so deleting an already-gone project is a no-op rather than a P2025/404. */
  async remove(projectId: string): Promise<void> {
    await this.prisma.project.deleteMany({ where: { id: projectId } })
  }
}
