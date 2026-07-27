import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "@core/database/prisma.service"
import { PaginationService } from "@shared/pagination/pagination.service"
import { TodoBodyDto } from "./dto/todo-body.dto"
import { ListTodosDto } from "./dto/list-todos.dto"
import { SORT_COLUMN, DEFAULT_TODO_SORT } from "./todo-sort"
import { TODO_SELECT } from "./todo-row"
import { TodoListResponse, TodoResponse, toTodoResponse } from "./dto/todo.response"

// Prisma's `contains` passes `%` and `_` through as live ILIKE wildcards; escape them
// (and the escape char itself) so a search term matches literally.
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&")

/** Project-scoped todo CRUD — every query filters on `projectId`, which is the tenant boundary. */
@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  /**
   * Resolves its own sort: `sort_by` has no DTO-layer default, so it falls back to `updated_at`.
   * `search` matches `title` case-insensitively, with ILIKE wildcards escaped to literals.
   */
  async list(projectId: string, query: ListTodosDto): Promise<TodoListResponse> {
    const sortBy = query.sort_by ?? DEFAULT_TODO_SORT
    const where = {
      projectId,
      ...(query.search
        ? { title: { contains: escapeLike(query.search), mode: "insensitive" as const } }
        : {}),
    }
    const totalItems = await this.prisma.todo.count({ where })
    const rows = await this.prisma.todo.findMany({
      where,
      select: TODO_SELECT,
      orderBy: { [SORT_COLUMN[sortBy]]: query.sort_order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })
    return {
      data: rows.map((row) => toTodoResponse(row)),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  /** Throws 404 when the id does not exist *in this project* — a sibling project's id misses. */
  async findOne(projectId: string, todoId: string): Promise<TodoResponse> {
    const todo = await this.prisma.todo.findFirst({
      where: { id: todoId, projectId },
      select: TODO_SELECT,
    })
    if (!todo) throw new NotFoundException("Todo not found")
    return toTodoResponse(todo)
  }

  /** Omitted body fields take creation defaults: `description` null, `is_completed` false. */
  async create(projectId: string, userId: string, dto: TodoBodyDto): Promise<TodoResponse> {
    const todo = await this.prisma.todo.create({
      data: {
        id: randomUUID(),
        projectId,
        userId,
        title: dto.title,
        description: dto.description ?? null,
        isCompleted: dto.is_completed ?? false,
      },
      select: TODO_SELECT,
    })
    return toTodoResponse(todo)
  }

  /**
   * Full replace: optional fields omitted from the body reset to their creation defaults, the
   * same `?? null` / `?? false` fallbacks `create()` uses. Throws 404 when no todo with that id
   * exists inside this project.
   */
  async update(projectId: string, todoId: string, dto: TodoBodyDto): Promise<TodoResponse> {
    // Scoped by projectId as well as id: ProjectGuard ties the project to the org, but nothing
    // ties this todo to that project, so this is what blocks a cross-tenant update by foreign id.
    const result = await this.prisma.todo.updateMany({
      where: { id: todoId, projectId },
      data: {
        title: dto.title,
        description: dto.description ?? null,
        isCompleted: dto.is_completed ?? false,
      },
    })
    if (result.count === 0) throw new NotFoundException("Todo not found")
    const todo = await this.prisma.todo.findUniqueOrThrow({
      where: { id: todoId },
      select: TODO_SELECT,
    })
    return toTodoResponse(todo)
  }

  /** Silent: ids outside this project are simply not deleted, never a 404. */
  async removeMany(projectId: string, ids: string[]): Promise<void> {
    await this.prisma.todo.deleteMany({ where: { projectId, id: { in: ids } } })
  }

  /** Idempotent: deleting a missing or foreign-project todo is a no-op, not a 404. */
  async removeOne(projectId: string, todoId: string): Promise<void> {
    await this.prisma.todo.deleteMany({ where: { projectId, id: todoId } })
  }
}
