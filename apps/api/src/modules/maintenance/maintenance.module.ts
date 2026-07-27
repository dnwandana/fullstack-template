import { Module } from "@nestjs/common"
import { CleanupService } from "./cleanup.service"

// PrismaModule is @Global and ConfigModule is registered with isGlobal: true, so both
// injections resolve without an explicit import here.
@Module({ providers: [CleanupService] })
export class MaintenanceModule {}
