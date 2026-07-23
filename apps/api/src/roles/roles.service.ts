import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { CreateRoleDto } from "./dto/create-role.dto"
import { UpdateRoleDto } from "./dto/update-role.dto"

const ROLE_SELECT = {
  id: true,
  orgId: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
} as const

type RoleRow = {
  id: string
  orgId: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

// API responses keep the Express-era snake_case contract the SPA consumes.
const toSnake = (role: RoleRow) => ({
  id: role.id,
  org_id: role.orgId,
  name: role.name,
  description: role.description,
  is_system: role.isSystem,
  created_at: role.createdAt,
  updated_at: role.updatedAt,
})

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"

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

  private permissionsOf(roleId: string) {
    return this.prisma.permission.findMany({
      where: { rolePermissions: { some: { roleId } } },
      select: { id: true, name: true, resource: true, action: true },
      orderBy: { name: "asc" },
    })
  }

  async findByOrg(orgId: string) {
    const rows = await this.prisma.role.findMany({
      where: { orgId },
      select: {
        ...ROLE_SELECT,
        rolePermissions: { select: { permission: { select: { id: true, name: true } } } },
      },
      orderBy: { name: "asc" },
    })
    return rows.map((r) => ({
      ...toSnake(r),
      permissions: r.rolePermissions.map((rp) => rp.permission),
    }))
  }

  async findOne(orgId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, orgId },
      select: ROLE_SELECT,
    })
    if (!role) throw new NotFoundException("Role not found in this organization")
    return { ...toSnake(role), permissions: await this.permissionsOf(roleId) }
  }

  async create(orgId: string, dto: CreateRoleDto) {
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
      return { ...toSnake(role), permissions: await this.permissionsOf(role.id) }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  async update(orgId: string, roleId: string, dto: UpdateRoleDto) {
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
      return { ...toSnake(updated), permissions: await this.permissionsOf(roleId) }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BadRequestException("A role with this name already exists")
      }
      throw err
    }
  }

  async remove(orgId: string, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Same org-level advisory lock the member-management paths take: member
      // FKs cascade on role delete, so a role assignment racing this delete
      // would silently erase membership rows. (A Restrict FK would close the
      // remaining window against paths that don't take the lock.)
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
  }
}
