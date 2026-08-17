import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { AuditService } from "@core/audit/audit.service"
import { diffFields } from "@core/audit/diff-fields"
import { OrgBodyDto } from "./dto/org-body.dto"
import { SYSTEM_ROLE_NAMES, SYSTEM_ROLE_PERMISSIONS } from "./system-roles"
import { ORG_SELECT } from "./org-row"
import { OrgResponse, toOrgResponse } from "./dto/org.response"

/** Org CRUD. Creation is the only path that mints roles and memberships. */
@Injectable()
export class OrgsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates the org, the four system roles in `SYSTEM_ROLE_NAMES`, and the caller's
   * owner membership in one transaction. Throws if any name in
   * `SYSTEM_ROLE_PERMISSIONS` has no row in the permissions table.
   */
  async createWithSystemRoles(userId: string, dto: OrgBodyDto): Promise<OrgResponse> {
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
        // Fail loudly on drift from the permissions table: skipping a name would mint
        // roles with missing grants for every org created afterwards. The transaction
        // rolls back cleanly.
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
    // Recorded after the transaction commits: an entry inside it would survive a rollback
    // in `AuditService.record`'s own connection, or be lost with the commit it describes.
    await this.audit.record({
      orgId: org.id,
      actorId: userId,
      action: "org.created",
      entityType: "org",
      entityId: org.id,
      entityName: org.name,
    })
    return toOrgResponse(org)
  }

  /** Orgs the user is a member of, newest first — not every org. */
  async findManyByUserId(userId: string): Promise<OrgResponse[]> {
    const rows = await this.prisma.organization.findMany({
      where: { orgMembers: { some: { userId } } },
      select: ORG_SELECT,
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toOrgResponse(row))
  }

  /** Returns `null` for an unknown id rather than throwing. */
  async findById(orgId: string): Promise<OrgResponse | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: ORG_SELECT,
    })
    return org ? toOrgResponse(org) : null
  }

  /** Prisma's `P2025` on an unknown id becomes a `404` via `AllExceptionsFilter`. */
  async update(orgId: string, actorId: string, dto: OrgBodyDto): Promise<OrgResponse> {
    const before = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, description: true },
    })
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name, description: dto.description ?? null },
      select: ORG_SELECT,
    })
    // A null `before` means the row vanished between the read and the update; the update
    // then throws P2025 before this line, so the guard only satisfies the type checker.
    const changes = before
      ? diffFields(
          { name: before.name, description: before.description },
          { name: org.name, description: org.description },
          ["name", "description"],
        )
      : null
    await this.audit.record({
      orgId,
      actorId,
      action: "org.updated",
      entityType: "org",
      entityId: orgId,
      entityName: org.name,
      changes,
    })
    return toOrgResponse(org)
  }

  /** Idempotent: `deleteMany` makes deleting an unknown org a no-op, not a `404`. */
  async remove(orgId: string, actorId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })
    if (org) {
      // Recorded before the delete on purpose: the org FK cascades, so a post-delete insert
      // would violate it. The entry cascades away with the org when the delete commits — the
      // accepted consequence from the spec. A failed delete leaves a stray entry; delete
      // failures surface as 5xx and are rare enough to accept.
      await this.audit.record({
        orgId,
        actorId,
        action: "org.deleted",
        entityType: "org",
        entityId: orgId,
        entityName: org.name,
      })
    }
    await this.prisma.organization.deleteMany({ where: { id: orgId } })
  }
}
