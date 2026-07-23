import { Module } from "@nestjs/common"
import { TodosService } from "./todos.service"
import { TodosController } from "./todos.controller"
import { TenancyModule } from "../tenancy/tenancy.module"
import { PaginationService } from "../common/pagination/pagination.service"

@Module({
  imports: [TenancyModule],
  controllers: [TodosController],
  providers: [TodosService, PaginationService],
})
export class TodosModule {}
