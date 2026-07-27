import { Module } from "@nestjs/common"
import { TodosService } from "./todos.service"
import { TodosController } from "./todos.controller"
import { TenancyModule } from "@tenancy/tenancy.module"
import { SharedModule } from "@shared/shared.module"

@Module({
  imports: [TenancyModule, SharedModule],
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
