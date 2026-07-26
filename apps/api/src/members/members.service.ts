import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { PaginationService } from "../common/pagination/pagination.service"
import { toSnakeKeys } from "../common/to-snake-keys"
import { ListQueryDto } from "../common/pagination/list-query.dto"

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  // Serializes owner-invariant checks per org: without this, two concurrent
  // demotions can each observe two owners and together leave the org with none.
  // Released automatically at transaction end. (::text — Prisma cannot
  // deserialize the function's void return.)
  private lockOrg(tx: Prisma.TransactionClient, orgId: string) {
    return tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`
  }

  async listOrgMembers(orgId: string, query: ListQueryDto) {
    const where = { orgId }
    const totalItems = await this.prisma.orgMember.count({ where })
    const rows = await this.prisma.orgMember.findMany({
      where,
      select: {
        userId: true,
        orgId: true,
        roleId: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
      // Deterministic order — pagination without a stable order is nondeterministic.
      orderBy: { joinedAt: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      // Destructure the relations off before mapping — nested objects must not
      // reach the shallow key mapper.
      data: rows.map(({ user, role, ...cols }) => ({
        ...toSnakeKeys(cols),
        name: user.name,
        email: user.email,
        role_name: role.name,
      })),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  async listProjectMembers(projectId: string, query: ListQueryDto) {
    const where = { projectId }
    const totalItems = await this.prisma.projectMember.count({ where })
    const rows = await this.prisma.projectMember.findMany({
      where,
      select: {
        userId: true,
        projectId: true,
        roleId: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
      // Deterministic order — pagination without a stable order is nondeterministic.
      orderBy: { joinedAt: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      // Destructure the relations off before mapping — nested objects must not
      // reach the shallow key mapper.
      data: rows.map(({ user, role, ...cols }) => ({
        ...toSnakeKeys(cols),
        name: user.name,
        email: user.email,
        role_name: role.name,
      })),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  private ownerCount(tx: Prisma.TransactionClient, orgId: string): Promise<number> {
    return tx.orgMember.count({ where: { orgId, role: { name: "owner" } } })
  }

  // Owner-gate (H-2): only owners may assign the owner role or change/remove an
  // owner. Re-reads the actor's role inside the locked transaction so the check
  // cannot go stale.
  private async assertActingIsOwner(
    tx: Prisma.TransactionClient,
    orgId: string,
    actingUserId: string,
  ) {
    const acting = await tx.orgMember.findUnique({
      where: { userId_orgId: { userId: actingUserId, orgId } },
      select: { role: { select: { name: true } } },
    })
    if (acting?.role.name !== "owner")
      throw new ForbiddenException("Only owners can assign or remove the owner role")
  }

  // Granting a role is granting its permissions: an actor may not hand out
  // permissions they do not hold themselves (H-2 fix b). actorPermissions is
  // guard-resolved at request time — the owner-gate re-read inside the locked
  // transaction remains the race-safe check for the owner paths.
  private assertGrantablePermissions(
    role: { rolePermissions: { permission: { name: string } }[] },
    actorPermissions: string[],
  ) {
    const unheld = role.rolePermissions.some((rp) => !actorPermissions.includes(rp.permission.name))
    if (unheld) throw new ForbiddenException("Cannot grant a role with permissions you do not hold")
  }

  async updateOrgMemberRole(
    orgId: string,
    actingUserId: string,
    targetUserId: string,
    roleId: string,
    actorPermissions: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, orgId)
      const role = await tx.role.findFirst({
        where: { id: roleId, orgId },
        select: {
          name: true,
          rolePermissions: { select: { permission: { select: { name: true } } } },
        },
      })
      if (!role) throw new NotFoundException("Role not found in this organization")

      const target = await tx.orgMember.findUnique({
        where: { userId_orgId: { userId: targetUserId, orgId } },
        select: { role: { select: { name: true } } },
      })
      if (!target) throw new NotFoundException("User is not a member of this organization")

      if (role.name === "owner" || target.role.name === "owner") {
        await this.assertActingIsOwner(tx, orgId, actingUserId)
      }

      this.assertGrantablePermissions(role, actorPermissions)

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
      const updated = await tx.orgMember.update({
        where: { userId_orgId: { userId: targetUserId, orgId } },
        data: { roleId },
        select: {
          userId: true,
          orgId: true,
          roleId: true,
          joinedAt: true,
          user: { select: { name: true, email: true } },
          role: { select: { name: true } },
        },
      })
      const { user, role: updatedRole, ...cols } = updated
      return {
        ...toSnakeKeys(cols),
        name: user.name,
        email: user.email,
        role_name: updatedRole.name,
      }
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

      if (target.role.name === "owner") {
        await this.assertActingIsOwner(tx, orgId, actingUserId)
      }

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
    actorPermissions: string[],
  ) {
    if (actingUserId === targetUserId)
      throw new BadRequestException("You cannot change your own role")
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: {
        name: true,
        rolePermissions: { select: { permission: { select: { name: true } } } },
      },
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    // Owner-gate (H-2): owner is an org-level concept — never assignable at project scope.
    if (role.name === "owner")
      throw new BadRequestException("The owner role cannot be assigned at project scope")
    this.assertGrantablePermissions(role, actorPermissions)
    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      select: { userId: true },
    })
    if (!target) throw new NotFoundException("User is not a member of this project")
    const updated = await this.prisma.projectMember.update({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      data: { roleId },
      select: {
        userId: true,
        projectId: true,
        roleId: true,
        joinedAt: true,
        user: { select: { name: true, email: true } },
        role: { select: { name: true } },
      },
    })
    const { user, role: updatedRole, ...cols } = updated
    return {
      ...toSnakeKeys(cols),
      name: user.name,
      email: user.email,
      role_name: updatedRole.name,
    }
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
