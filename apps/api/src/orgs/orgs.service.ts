import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { toSnakeKeys } from "../common/to-snake-keys"
import { OrgBodyDto } from "./dto/org-body.dto"
import { SYSTEM_ROLE_NAMES, SYSTEM_ROLE_PERMISSIONS } from "./system-roles"

const ORG_SELECT = {
  id: true,
  name: true,
  description: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} as const

type OrgRow = {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService) {}

  async createWithSystemRoles(userId: string, dto: OrgBodyDto) {
    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          id: randomUUID(),
          name: dto.name,
          description: dto.description ?? null,
          createdBy: userId,
        },
        select: ORG_SELECT,
      })

      const permissions = await tx.permission.findMany({ select: { id: true, name: true } })
      const permIdByName = new Map(permissions.map((p) => [p.name, p.id]))

      let ownerRoleId = ""
      for (const roleName of SYSTEM_ROLE_NAMES) {
        const role = await tx.role.create({
          data: {
            id: randomUUID(),
            orgId: created.id,
            name: roleName,
            isSystem: true,
            description: `System ${roleName} role`,
          },
          select: { id: true },
        })
        if (roleName === "owner") ownerRoleId = role.id
        // Fail loudly on drift between SYSTEM_ROLE_PERMISSIONS and the permissions
        // table — silently skipping a name would mint roles with missing grants
        // for every org created afterwards. The transaction rolls back cleanly.
        const permissionIds = SYSTEM_ROLE_PERMISSIONS[roleName].map((n) => {
          const id = permIdByName.get(n)
          if (!id) throw new Error(`Unknown permission "${n}" for system role "${roleName}"`)
          return id
        })
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        })
      }

      await tx.orgMember.create({ data: { orgId: created.id, userId, roleId: ownerRoleId } })
      return created
    })
    return toSnakeKeys<OrgRow>(org)
  }

  async findManyByUserId(userId: string) {
    const rows = await this.prisma.organization.findMany({
      where: { orgMembers: { some: { userId } } },
      select: ORG_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toSnakeKeys<OrgRow>(row))
  }

  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: ORG_SELECT,
    })
    return org ? toSnakeKeys<OrgRow>(org) : null
  }

  async update(orgId: string, dto: OrgBodyDto) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name, description: dto.description ?? null },
      select: ORG_SELECT,
    })
    return toSnakeKeys<OrgRow>(org)
  }

  async remove(orgId: string): Promise<void> {
    await this.prisma.organization.deleteMany({ where: { id: orgId } })
  }
}
