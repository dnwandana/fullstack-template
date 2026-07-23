import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common"
import { TodosService } from "./todos.service"
import { TodoBodyDto } from "./dto/todo-body.dto"
import { ListTodosDto } from "./dto/list-todos.dto"
import { BulkDeleteDto } from "./dto/bulk-delete.dto"
import { CurrentUser } from "../common/decorators/current-user.decorator"
import { CurrentProject } from "../common/decorators/current-project.decorator"
import { RequirePermission } from "../common/decorators/require-permission.decorator"
import { OrgGuard } from "../tenancy/org.guard"
import { ProjectGuard } from "../tenancy/project.guard"
import { PermissionsGuard } from "../tenancy/permissions.guard"

@Controller("orgs/:org_id/projects/:project_id/todos")
@UseGuards(OrgGuard, ProjectGuard, PermissionsGuard)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get()
  @RequirePermission("todos:read")
  async list(@CurrentProject() project: { id: string }, @Query() query: ListTodosDto) {
    const { data, pagination } = await this.todos.list(project.id, query)
    return { message: "OK", data, pagination }
  }

  @Post()
  @RequirePermission("todos:create")
  async create(
    @CurrentProject() project: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: TodoBodyDto,
  ) {
    return { message: "Created", data: await this.todos.create(project.id, userId, dto) }
  }

  @Get(":todo_id")
  @RequirePermission("todos:read")
  async read(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
  ) {
    return { message: "OK", data: await this.todos.findOne(project.id, todoId) }
  }

  @Put(":todo_id")
  @RequirePermission("todos:update")
  async update(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
    @Body() dto: TodoBodyDto,
  ) {
    return { message: "OK", data: await this.todos.update(project.id, todoId, dto) }
  }

  @Delete()
  @RequirePermission("todos:delete")
  async bulkRemove(@CurrentProject() project: { id: string }, @Query() query: BulkDeleteDto) {
    await this.todos.removeMany(project.id, query.ids)
    return { message: "OK", data: null }
  }

  @Delete(":todo_id")
  @RequirePermission("todos:delete")
  async removeOne(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
  ) {
    await this.todos.removeOne(project.id, todoId)
    return { message: "OK", data: null }
  }
}
