import { Module } from "@nestjs/common"
import { AuditLogsService } from "./audit-logs.service"
import { AuditLogsController } from "./audit-logs.controller"
import { TenancyModule } from "@tenancy/tenancy.module"
import { SharedModule } from "@shared/shared.module"

@Module({
  imports: [TenancyModule, SharedModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
