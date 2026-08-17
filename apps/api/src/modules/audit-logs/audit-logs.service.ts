import { Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import type { PaginationMeta } from "@fullstack/contracts"
import { PrismaService } from "@core/database/prisma.service"
import { PaginationService } from "@shared/pagination/pagination.service"
import { AUDIT_LOG_SELECT } from "./audit-log-row"
import { AuditLogResponse, toAuditLogResponse } from "./dto/audit-log.response"
import type { ListAuditLogsDto } from "./dto/list-audit-logs.dto"

// Deliberate duplication: each module keeps its own copy (precedent documented
// on invite-row.ts) instead of a shared util.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

const DAY_MS = 86_400_000

// A date-only `date_to` names a whole day, but it parses to that day's first
// instant. An inclusive bound there would exclude the named day, so the bound
// becomes an exclusive `lt` on the next day.
const dateToBound = (value: string): Prisma.DateTimeFilter =>
  value.includes("T")
    ? { lte: new Date(value) }
    : { lt: new Date(new Date(value).getTime() + DAY_MS) }

/** Read-only audit-log queries — every query filters on `orgId`, which is the tenant boundary. */
@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  /**
   * Lists one org's audit entries, newest first by default. Each optional filter narrows the
   * `orgId` base clause; `search` matches `entityName` case-insensitively with ILIKE wildcards
   * escaped to literals.
   */
  async list(
    orgId: string,
    query: ListAuditLogsDto,
  ): Promise<{ data: AuditLogResponse[]; pagination: PaginationMeta }> {
    const where: Prisma.AuditLogWhereInput = {
      orgId,
      ...(query.project_id && { projectId: query.project_id }),
      ...(query.actor_id && { actorId: query.actor_id }),
      ...(query.action && { action: query.action }),
      ...(query.entity_type && { entityType: query.entity_type }),
      ...((query.date_from || query.date_to) && {
        createdAt: {
          ...(query.date_from && { gte: new Date(query.date_from) }),
          ...(query.date_to && dateToBound(query.date_to)),
        },
      }),
      ...(query.search && {
        entityName: { contains: escapeLike(query.search), mode: "insensitive" as const },
      }),
    }
    const [totalItems, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_LOG_SELECT,
        orderBy: { createdAt: query.sort_order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])
    return {
      data: rows.map((row) => toAuditLogResponse(row)),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }
}
