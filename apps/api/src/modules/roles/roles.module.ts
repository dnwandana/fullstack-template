import { Module } from "@nestjs/common"
import { RolesService } from "./roles.service"
import { RolesController } from "./roles.controller"
import { TenancyModule } from "@tenancy/tenancy.module"

@Module({
  imports: [TenancyModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
