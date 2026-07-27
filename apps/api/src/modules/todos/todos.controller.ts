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
} from "@nestjs/common"
import { TodosService } from "./todos.service"
import { TodoResponse } from "./dto/todo.response"
import type { Payload } from "@shared/dto/response.types"
import { TodoBodyDto } from "./dto/todo-body.dto"
import { ListTodosDto } from "./dto/list-todos.dto"
import { BulkDeleteDto } from "./dto/bulk-delete.dto"
import { CurrentUser } from "@shared/decorators/current-user.decorator"
import { CurrentProject } from "@shared/decorators/current-project.decorator"
import { RequirePermission } from "@shared/decorators/require-permission.decorator"
import { ProjectScoped } from "@tenancy/scoped.decorators"

/** Project-scoped todo routes; `@ProjectScoped()` is bare, so each handler names a permission. */
@Controller("orgs/:org_id/projects/:project_id/todos")
@ProjectScoped()
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  // `limit` defaults to 10 (`ListTodosDto`), and `sort_by` accepts only `updated_at`/`title`.
  @Get()
  @RequirePermission("todos:read")
  async list(
    @CurrentProject() project: { id: string },
    @Query() query: ListTodosDto,
  ): Promise<Payload<TodoResponse[]>> {
    const { data, pagination } = await this.todos.list(project.id, query)
    return { message: "OK", data, pagination }
  }

  @Post()
  @RequirePermission("todos:create")
  async create(
    @CurrentProject() project: { id: string },
    @CurrentUser("id") userId: string,
    @Body() dto: TodoBodyDto,
  ): Promise<Payload<TodoResponse>> {
    return { message: "Created", data: await this.todos.create(project.id, userId, dto) }
  }

  @Get(":todo_id")
  @RequirePermission("todos:read")
  async read(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
  ): Promise<Payload<TodoResponse>> {
    return { message: "OK", data: await this.todos.findOne(project.id, todoId) }
  }

  @Put(":todo_id")
  @RequirePermission("todos:update")
  async update(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
    @Body() dto: TodoBodyDto,
  ): Promise<Payload<TodoResponse>> {
    return { message: "OK", data: await this.todos.update(project.id, todoId, dto) }
  }

  // Ids arrive as a comma-separated `ids` query param, 1-50 UUIDs; unmatched ids are ignored.
  @Delete()
  @RequirePermission("todos:delete")
  async bulkRemove(
    @CurrentProject() project: { id: string },
    @Query() query: BulkDeleteDto,
  ): Promise<Payload<null>> {
    await this.todos.removeMany(project.id, query.ids)
    return { message: "OK", data: null }
  }

  @Delete(":todo_id")
  @RequirePermission("todos:delete")
  async removeOne(
    @CurrentProject() project: { id: string },
    @Param("todo_id", ParseUUIDPipe) todoId: string,
  ): Promise<Payload<null>> {
    await this.todos.removeOne(project.id, todoId)
    return { message: "OK", data: null }
  }
}
