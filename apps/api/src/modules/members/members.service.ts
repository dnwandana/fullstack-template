import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@core/database/prisma.service"
import { PaginationService } from "@shared/pagination/pagination.service"
import { toSnakeKeys } from "@shared/utils/to-snake-keys"
import { ListQueryDto } from "@shared/pagination/list-query.dto"

/** Membership reads and writes; the last-owner invariant is enforced here, not by the schema. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  // Serializes the owner-invariant checks per org: without it, two concurrent demotions each
  // observe two owners and together leave the org with none. Transaction-scoped, so it releases
  // at commit. (::text — Prisma cannot deserialize the function's void return.)
  private lockOrg(tx: Prisma.TransactionClient, orgId: string) {
    return tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`
  }

  /**
   * Fixed `joined_at asc` ordering — `query.sort_by`/`sort_order` are accepted and ignored.
   * `limit` defaults to 50 (`ListQueryDto`), not the 10 todos uses.
   */
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
      // Stable order: pagination over an unordered query can repeat or skip rows.
      orderBy: { joinedAt: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      // Relations destructured off first — `toSnakeKeys` is shallow and would pass
      // nested objects through unmapped.
      data: rows.map(({ user, role, ...cols }) => ({
        ...toSnakeKeys(cols),
        name: user.name,
        email: user.email,
        role_name: role.name,
      })),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  /**
   * Fixed `joined_at asc` ordering — `query.sort_by`/`sort_order` are accepted and ignored.
   * `limit` defaults to 50 (`ListQueryDto`), not the 10 todos uses.
   */
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
      // Stable order: pagination over an unordered query can repeat or skip rows.
      orderBy: { joinedAt: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      // Relations destructured off first — `toSnakeKeys` is shallow and would pass
      // nested objects through unmapped.
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

  // Owner-gate (H-2): only owners may assign the owner role or change/remove an owner.
  // Re-read inside the locked transaction so the actor's role cannot go stale.
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

  // Granting a role grants its permissions, so an actor may not hand out permissions they do
  // not hold (H-2 fix b). actorPermissions is guard-resolved at request time; the owner-gate
  // re-read inside the locked transaction stays the race-safe check for the owner paths.
  private assertGrantablePermissions(
    role: { rolePermissions: { permission: { name: string } }[] },
    actorPermissions: string[],
  ) {
    const unheld = role.rolePermissions.some((rp) => !actorPermissions.includes(rp.permission.name))
    if (unheld) throw new ForbiddenException("Cannot grant a role with permissions you do not hold")
  }

  /**
   * Throws 400 when the change demotes the last owner or is a self-change, 403 when a non-owner
   * touches the owner role or grants permissions they lack, 404 for an unknown role or member.
   * The per-org advisory lock is what stops two concurrent demotions both passing that check.
   */
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

      // Ahead of the self-action guard so demoting the last owner reports that reason
      // rather than "you cannot change your own role".
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

  /**
   * Throws 400 on removing the last owner or yourself, 403 when a non-owner removes an owner,
   * 404 for a non-member. Shares the per-org advisory lock with role changes, so a concurrent
   * demotion cannot slip past the last-owner check and strand the org ownerless.
   */
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

      // Ahead of the self-action guard so removing the last owner reports that reason
      // rather than "you cannot remove yourself".
      if (target.role.name === "owner" && (await this.ownerCount(tx, orgId)) <= 1) {
        throw new BadRequestException("Cannot remove the last owner")
      }
      if (actingUserId === targetUserId) throw new BadRequestException("You cannot remove yourself")
      await tx.orgMember.delete({
        where: { userId_orgId: { userId: targetUserId, orgId } },
      })
    })
  }

  /**
   * Throws 400 for a self-change or for the owner role (org-level only), 403 when granting
   * permissions the actor does not hold, 404 for an unknown role or a non-member. No lock: no
   * project-level invariant depends on a member count.
   */
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

  /** Throws 400 on self-removal and 404 when the user is not a member of the project. */
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
