import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  // Serializes owner-invariant checks per org: without this, two concurrent
  // demotions can each observe two owners and together leave the org with none.
  // Released automatically at transaction end. (::text — Prisma cannot
  // deserialize the function's void return.)
  private lockOrg(tx: Prisma.TransactionClient, orgId: string) {
    return tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`
  }

  async listOrgMembers(orgId: string) {
    const rows = await this.prisma.orgMember.findMany({
      where: { orgId },
      select: {
        userId: true,
        orgId: true,
        roleId: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
    })
    return rows.map((m) => ({
      user_id: m.userId,
      org_id: m.orgId,
      role_id: m.roleId,
      joined_at: m.joinedAt,
      name: m.user.name,
      email: m.user.email,
      role_name: m.role.name,
    }))
  }

  async listProjectMembers(projectId: string) {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        userId: true,
        projectId: true,
        roleId: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
    })
    return rows.map((m) => ({
      user_id: m.userId,
      project_id: m.projectId,
      role_id: m.roleId,
      joined_at: m.joinedAt,
      name: m.user.name,
      email: m.user.email,
      role_name: m.role.name,
    }))
  }

  private ownerCount(tx: Prisma.TransactionClient, orgId: string): Promise<number> {
    return tx.orgMember.count({ where: { orgId, role: { name: "owner" } } })
  }

  async updateOrgMemberRole(
    orgId: string,
    actingUserId: string,
    targetUserId: string,
    roleId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, orgId)
      const role = await tx.role.findFirst({
        where: { id: roleId, orgId },
        select: { name: true },
      })
      if (!role) throw new NotFoundException("Role not found in this organization")

      const target = await tx.orgMember.findUnique({
        where: { userId_orgId: { userId: targetUserId, orgId } },
        select: { role: { select: { name: true } } },
      })
      if (!target) throw new NotFoundException("User is not a member of this organization")

      // Protect the org-orphaning invariant before the self-action guard: demoting
      // the last owner is blocked with a specific reason even when it's a self-change.
      if (
        target.role.name === "owner" &&
        role.name !== "owner" &&
        (await this.ownerCount(tx, orgId)) <= 1
      ) {
        throw new BadRequestException("Cannot change role of the last owner")
      }
      if (actingUserId === targetUserId)
        throw new BadRequestException("You cannot change your own role")
      await tx.orgMember.update({
        where: { userId_orgId: { userId: targetUserId, orgId } },
        data: { roleId },
      })
    })
  }

  async removeOrgMember(orgId: string, actingUserId: string, targetUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, orgId)
      const target = await tx.orgMember.findUnique({
        where: { userId_orgId: { userId: targetUserId, orgId } },
        select: { role: { select: { name: true } } },
      })
      if (!target) throw new NotFoundException("User is not a member of this organization")

      // Protect the org-orphaning invariant before the self-action guard: removing
      // the last owner is blocked with a specific reason even when it's a self-removal.
      if (target.role.name === "owner" && (await this.ownerCount(tx, orgId)) <= 1) {
        throw new BadRequestException("Cannot remove the last owner")
      }
      if (actingUserId === targetUserId) throw new BadRequestException("You cannot remove yourself")
      await tx.orgMember.delete({
        where: { userId_orgId: { userId: targetUserId, orgId } },
      })
    })
  }

  async updateProjectMemberRole(
    orgId: string,
    projectId: string,
    actingUserId: string,
    targetUserId: string,
    roleId: string,
  ) {
    if (actingUserId === targetUserId)
      throw new BadRequestException("You cannot change your own role")
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: { id: true },
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      select: { userId: true },
    })
    if (!target) throw new NotFoundException("User is not a member of this project")
    await this.prisma.projectMember.update({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      data: { roleId },
    })
  }

  async removeProjectMember(projectId: string, actingUserId: string, targetUserId: string) {
    if (actingUserId === targetUserId) throw new BadRequestException("You cannot remove yourself")
    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      select: { userId: true },
    })
    if (!target) throw new NotFoundException("User is not a member of this project")
    await this.prisma.projectMember.delete({
      where: { userId_projectId: { userId: targetUserId, projectId } },
    })
  }
}
