import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveOrg(
    userId: string,
    orgId: string,
  ): Promise<{
    org: { id: string; role_name: string } | null
    found: boolean
    permissions: string[]
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    })
    if (!org) return { org: null, found: false, permissions: [] }

    const membership = await this.prisma.orgMember.findFirst({
      where: { orgId, userId },
      select: {
        role: {
          select: {
            name: true,
            rolePermissions: { select: { permission: { select: { name: true } } } },
          },
        },
      },
    })
    if (!membership) return { org: null, found: true, permissions: [] }

    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.name)
    return { org: { id: orgId, role_name: membership.role.name }, found: true, permissions }
  }

  async resolveProject(
    userId: string,
    orgId: string,
    projectId: string,
    orgPermissions: string[],
  ): Promise<{ project: { id: string } | null; permissions: string[] }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true },
    })
    if (!project) return { project: null, permissions: orgPermissions }

    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: {
        role: {
          select: { rolePermissions: { select: { permission: { select: { name: true } } } } },
        },
      },
    })
    const projectPerms = membership?.role.rolePermissions.map((rp) => rp.permission.name) ?? []
    const merged = Array.from(new Set([...orgPermissions, ...projectPerms]))
    return { project: { id: projectId }, permissions: merged }
  }
}
