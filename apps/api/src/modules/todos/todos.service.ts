import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuditService } from "@core/audit/audit.service"
import { diffFields } from "@core/audit/diff-fields"
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
    private readonly audit: AuditService,
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
  async create(
    orgId: string,
    projectId: string,
    userId: string,
    dto: TodoBodyDto,
  ): Promise<TodoResponse> {
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
    await this.audit.record({
      orgId,
      projectId,
      actorId: userId,
      action: "todo.created",
      entityType: "todo",
      entityId: todo.id,
      entityName: todo.title,
    })
    return toTodoResponse(todo)
  }

  /**
   * Full replace: optional fields omitted from the body reset to their creation defaults, the
   * same `?? null` / `?? false` fallbacks `create()` uses. Throws 404 when no todo with that id
   * exists inside this project.
   */
  async update(
    orgId: string,
    projectId: string,
    actorId: string,
    todoId: string,
    dto: TodoBodyDto,
  ): Promise<TodoResponse> {
    // Read before the write: the audit diff needs the pre-update field values.
    const before = await this.prisma.todo.findFirst({
      where: { id: todoId, projectId },
      select: TODO_SELECT,
    })
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
    // Diff over the response shapes so the `changes` keys match the wire format the UI
    // shows. The spread copies each class instance into a plain record for `diffFields`.
    const changes = before
      ? diffFields({ ...toTodoResponse(before) }, { ...toTodoResponse(todo) }, [
          "title",
          "description",
          "is_completed",
        ])
      : null
    await this.audit.record({
      orgId,
      projectId,
      actorId,
      action: "todo.updated",
      entityType: "todo",
      entityId: todoId,
      entityName: todo.title,
      changes,
    })
    return toTodoResponse(todo)
  }

  /** Silent: ids outside this project are simply not deleted, never a 404. */
  async removeMany(
    orgId: string,
    projectId: string,
    actorId: string,
    ids: string[],
  ): Promise<void> {
    // Read the rows before the delete: the audit entries need their ids and titles.
    const rows = await this.prisma.todo.findMany({
      where: { projectId, id: { in: ids } },
      select: { id: true, title: true },
    })
    await this.prisma.todo.deleteMany({ where: { projectId, id: { in: ids } } })
    for (const row of rows) {
      await this.audit.record({
        orgId,
        projectId,
        actorId,
        action: "todo.deleted",
        entityType: "todo",
        entityId: row.id,
        entityName: row.title,
      })
    }
  }

  /** Idempotent: deleting a missing or foreign-project todo is a no-op, not a 404. */
  async removeOne(
    orgId: string,
    projectId: string,
    actorId: string,
    todoId: string,
  ): Promise<void> {
    // Read the row before the delete: the audit entry needs its title.
    const row = await this.prisma.todo.findFirst({
      where: { id: todoId, projectId },
      select: { id: true, title: true },
    })
    const result = await this.prisma.todo.deleteMany({ where: { projectId, id: todoId } })
    if (row && result.count === 1) {
      await this.audit.record({
        orgId,
        projectId,
        actorId,
        action: "todo.deleted",
        entityType: "todo",
        entityId: row.id,
        entityName: row.title,
      })
    }
  }
}
