import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { AuditService } from "@core/audit/audit.service"
import { diffFields } from "@core/audit/diff-fields"
import { PrismaService } from "@core/database/prisma.service"
import { CreateRoleDto } from "./dto/create-role.dto"
import { UpdateRoleDto } from "./dto/update-role.dto"
import { PERMISSION_SELECT, ROLE_SELECT } from "./role-row"
import { PermissionResponse, RoleResponse, toRoleResponse } from "./dto/role.response"

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"

// P2003 is Postgres's raw FK rejection (SQLSTATE 23503) when a RESTRICT reference
// still points at the row being deleted; P2014 is Prisma detecting the same
// condition itself as a required-relation violation.
const isForeignKeyViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === "P2003" || err.code === "P2014")

/** Custom role CRUD within one org. System roles are read-only through it. */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Valid-UUID-but-unknown permission ids would otherwise surface as an FK
  // violation (P2003) → 500. Returns the deduped id list to insert.
  private async assertPermissionsExist(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)]
    const count = await this.prisma.permission.count({ where: { id: { in: unique } } })
    if (count !== unique.length) {
      throw new BadRequestException("One or more permissions do not exist")
    }
    return unique
  }

  private permissionsOf(roleId: string): Promise<PermissionResponse[]> {
    return this.prisma.permission.findMany({
      where: { rolePermissions: { some: { roleId } } },
      select: PERMISSION_SELECT,
      orderBy: { name: "asc" },
    })
  }

  /**
   * Every role in the org, name-ascending, each carrying the same permission
   * projection `findOne` returns — list and detail must not drift.
   */
  async findByOrg(orgId: string): Promise<RoleResponse[]> {
    const rows = await this.prisma.role.findMany({
      where: { orgId },
      select: {
        ...ROLE_SELECT,
        rolePermissions: { select: { permission: { select: PERMISSION_SELECT } } },
      },
      orderBy: { name: "asc" },
    })
    // Destructure the relation off first: the key mapper is shallow and must never
    // see a nested object.
    return rows.map(({ rolePermissions, ...cols }) =>
      toRoleResponse(
        cols,
        rolePermissions.map((rp) => rp.permission),
      ),
    )
  }

  /** Throws `404` when the role exists but belongs to another org. */
  async findOne(orgId: string, roleId: string): Promise<RoleResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: ROLE_SELECT,
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    return toRoleResponse(role, await this.permissionsOf(roleId))
  }

  /** Throws `400` for a duplicate name or an unknown permission id, never a `500`. */
  async create(orgId: string, actorId: string, dto: CreateRoleDto): Promise<RoleResponse> {
    const permissionIds = await this.assertPermissionsExist(dto.permission_ids)
    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const created = await tx.role.create({
          data: {
            id: randomUUID(),
            orgId,
            name: dto.name,
            description: dto.description ?? null,
            isSystem: false,
          },
          select: ROLE_SELECT,
        })
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        })
        return created
      })
      // Recorded after the transaction commits; `record` never throws.
      await this.audit.record({
        orgId,
        actorId,
        action: "role.created",
        entityType: "role",
        entityId: role.id,
        entityName: role.name,
      })
      return toRoleResponse(role, await this.permissionsOf(role.id))
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  /**
   * Throws `400` for a system role or a duplicate name. `permission_ids`, when
   * given, wholly replaces the role's grants rather than merging into them.
   */
  async update(
    orgId: string,
    actorId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    // The permission ids ride along on the authorization read; the audit diff needs them.
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: {
        id: true,
        isSystem: true,
        name: true,
        description: true,
        rolePermissions: { select: { permissionId: true } },
      },
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    if (role.isSystem) throw new BadRequestException("System roles cannot be modified")

    const permissionIds = dto.permission_ids
      ? await this.assertPermissionsExist(dto.permission_ids)
      : null
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.role.update({
          where: { id: roleId },
          data: { name: dto.name, description: dto.description ?? undefined },
          select: ROLE_SELECT,
        })
        if (permissionIds) {
          await tx.rolePermission.deleteMany({ where: { roleId } })
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          })
        }
        return row
      })
      const permissions = await this.permissionsOf(roleId)
      // Sorted copies: a reorder of the same permission set never registers as a change.
      const beforeState = {
        name: role.name,
        description: role.description,
        permission_ids: role.rolePermissions.map((rp) => rp.permissionId).toSorted(),
      }
      const afterState = {
        name: updated.name,
        description: updated.description,
        permission_ids: permissions.map((p) => p.id).toSorted(),
      }
      const changes = diffFields(beforeState, afterState, [
        "name",
        "description",
        "permission_ids",
      ])
      // Recorded after the transaction commits; `record` never throws.
      await this.audit.record({
        orgId,
        actorId,
        action: "role.updated",
        entityType: "role",
        entityId: roleId,
        entityName: updated.name,
        changes,
      })
      return toRoleResponse(updated, permissions)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  /**
   * Throws `400` for a system role, and for one still assigned to any org or
   * project member — deleting a role must never strip memberships.
   */
  async remove(orgId: string, actorId: string, roleId: string): Promise<void> {
    try {
      const roleName = await this.prisma.$transaction(async (tx) => {
        // Same org-level advisory lock the member-management paths take, so a role
        // assignment racing this delete cannot slip past the in-use count below. Paths
        // that never take the lock are closed by the RESTRICT FKs — see the catch.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`
        const role = await tx.role.findFirst({
          where: { id: roleId, orgId },
          select: { id: true, isSystem: true, name: true },
        })
        if (!role) throw new NotFoundException("Role not found in this organization")
        if (role.isSystem) throw new BadRequestException("System roles cannot be deleted")

        const inUse = await tx.orgMember.count({ where: { roleId } })
        const inUseProject = await tx.projectMember.count({ where: { roleId } })
        if (inUse + inUseProject > 0)
          throw new BadRequestException("Cannot delete a role that is in use")

        await tx.role.delete({ where: { id: roleId } })
        return role.name
      })
      // Recorded only after the delete commits; a failed delete leaves no entry.
      await this.audit.record({
        orgId,
        actorId,
        action: "role.deleted",
        entityType: "role",
        entityId: roleId,
        entityName: roleName,
      })
    } catch (err) {
      // `OrgMember.role`/`ProjectMember.role` are `onDelete: Restrict`, so deleting an
      // in-use role cannot silently strip memberships. Map that rejection to the same
      // 400 the fast-path count check produces, so neither path leaks a 500.
      if (isForeignKeyViolation(err)) {
        throw new BadRequestException("Cannot delete a role that is in use")
      }
      throw err
    }
  }
}
