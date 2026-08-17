import { Controller, Get, Query } from "@nestjs/common"
import { AuditLogsService } from "./audit-logs.service"
import { AuditLogResponse } from "./dto/audit-log.response"
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto"
import type { Payload } from "@shared/dto/response.types"
import { CurrentOrg } from "@shared/decorators/current-org.decorator"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { OrgScoped } from "@tenancy/scoped.decorators"

/** Read-only org-scoped audit-log route — the trail is append-only, so no mutation handler exists. */
@Controller("orgs/:org_id/audit-logs")
@OrgScoped()
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @RequirePermission("audit:read")
  async list(
    @CurrentOrg() org: { id: string },
    @Query() query: ListAuditLogsDto,
  ): Promise<Payload<AuditLogResponse[]>> {
    return { message: "OK", ...(await this.auditLogs.list(org.id, query)) }
  }
}
