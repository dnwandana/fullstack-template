import { Module } from "@nestjs/common"
import { OrgsService } from "./orgs.service"
import { OrgsController } from "./orgs.controller"
import { TenancyModule } from "../tenancy/tenancy.module"

@Module({
  imports: [TenancyModule],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
