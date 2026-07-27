import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { CreateRoleDto } from "./dto/create-role.dto"
import { UpdateRoleDto } from "./dto/update-role.dto"
import { PERMISSION_SELECT, ROLE_SELECT } from "./role-row"
import { PermissionResponse, RoleResponse, toRoleResponse } from "./dto/role.response"

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"

// P2003 is the raw foreign-key rejection Postgres raises (SQLSTATE 23503) when a
// RESTRICT/NO ACTION reference still points at the row being deleted. P2014 is the
// same condition detected by Prisma itself as a required-relation violation.
const isForeignKeyViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === "P2003" || err.code === "P2014")

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findByOrg(orgId: string): Promise<RoleResponse[]> {
    const rows = await this.prisma.role.findMany({
      where: { orgId },
      select: {
        ...ROLE_SELECT,
        rolePermissions: { select: { permission: { select: PERMISSION_SELECT } } },
      },
      orderBy: { name: "asc" },
    })
    // Destructure the relation off before mapping — nested objects must not
    // reach the shallow key mapper.
    return rows.map(({ rolePermissions, ...cols }) =>
      toRoleResponse(
        cols,
        rolePermissions.map((rp) => rp.permission),
      ),
    )
  }

  async findOne(orgId: string, roleId: string): Promise<RoleResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: ROLE_SELECT,
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    return toRoleResponse(role, await this.permissionsOf(roleId))
  }

  async create(orgId: string, dto: CreateRoleDto): Promise<RoleResponse> {
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
      return toRoleResponse(role, await this.permissionsOf(role.id))
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  async update(orgId: string, roleId: string, dto: UpdateRoleDto): Promise<RoleResponse> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: { id: true, isSystem: true },
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
      return toRoleResponse(updated, await this.permissionsOf(roleId))
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  async remove(orgId: string, roleId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Same org-level advisory lock the member-management paths take, so a role
        // assignment racing this delete cannot slip past the in-use count below.
        // The member role FKs are RESTRICT, which closes the remaining window
        // against paths that never take the lock (see the catch below).
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`
        const role = await tx.role.findFirst({
          where: { id: roleId, orgId },
          select: { id: true, isSystem: true },
        })
        if (!role) throw new NotFoundException("Role not found in this organization")
        if (role.isSystem) throw new BadRequestException("System roles cannot be deleted")

        const inUse = await tx.orgMember.count({ where: { roleId } })
        const inUseProject = await tx.projectMember.count({ where: { roleId } })
        if (inUse + inUseProject > 0)
          throw new BadRequestException("Cannot delete a role that is in use")

        await tx.role.delete({ where: { id: roleId } })
      })
    } catch (err) {
      // The advisory lock narrows the in-use race but does not close it for callers
      // that never take the lock; the RESTRICT FKs do. Translate that DB-level
      // rejection into the same 400 the fast-path count check produces, so both
      // paths look identical to clients instead of leaking a 500.
      if (isForeignKeyViolation(err)) {
        throw new BadRequestException("Cannot delete a role that is in use")
      }
      throw err
    }
  }
}
