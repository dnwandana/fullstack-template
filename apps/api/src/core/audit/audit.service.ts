import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@core/database/prisma.service"
import type { AuditEvent } from "./audit-action"

/** Append-only audit writer. `record` never throws: an audit failure must not fail the mutation. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      let actorName = "Unknown"
      let actorEmail: string | null = null
      if (event.actorId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: event.actorId },
          select: { name: true, email: true },
        })
        if (actor) {
          actorName = actor.name
          actorEmail = actor.email
        }
      }
      await this.prisma.auditLog.create({
        data: {
          id: randomUUID(),
          orgId: event.orgId,
          projectId: event.projectId ?? null,
          actorId: event.actorId,
          actorName,
          actorEmail,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          entityName: event.entityName,
          // Prisma.DbNull writes SQL NULL; a bare null is rejected for Json columns.
          // AuditChanges is JSON-safe by construction (it comes from diffFields).
          changes: event.changes ? (event.changes as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })
    } catch (err) {
      this.logger.error(
        `Audit write failed for ${event.action} on ${event.entityType} ${event.entityId}: ` +
          (err instanceof Error ? err.message : String(err)),
      )
    }
  }
}
