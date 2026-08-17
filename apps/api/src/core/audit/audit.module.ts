import { Global, Module } from "@nestjs/common"
import { AuditService } from "./audit.service"

// @Global(), so feature modules inject AuditService without an import — which keeps
// the no-sibling-imports rule intact (the QueueModule pattern).
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
