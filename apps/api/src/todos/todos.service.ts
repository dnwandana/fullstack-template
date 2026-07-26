import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { PrismaService } from "../prisma/prisma.service"
import { PaginationService } from "../common/pagination/pagination.service"
import { toSnakeKeys } from "../common/to-snake-keys"
import { TodoBodyDto } from "./dto/todo-body.dto"
import { ListTodosDto } from "./dto/list-todos.dto"

const TODO_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  title: true,
  description: true,
  isCompleted: true,
  createdAt: true,
  updatedAt: true,
} as const
const SORT_COLUMN: Record<string, "updatedAt" | "title"> = {
  updated_at: "updatedAt",
  title: "title",
}

type TodoRow = {
  id: string
  projectId: string
  userId: string
  title: string
  description: string | null
  isCompleted: boolean
  createdAt: Date
  updatedAt: Date
}

// Prisma's `contains` passes `%` and `_` through as live ILIKE wildcards;
// escape them (and the escape char itself) so search terms match literally.
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&")

@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  async list(projectId: string, query: ListTodosDto) {
    const sortBy = query.sort_by ?? "updated_at"
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
      data: rows.map((row) => toSnakeKeys<TodoRow>(row)),
      pagination: this.pagination.buildMeta(query.page, query.limit, totalItems),
    }
  }

  async findOne(projectId: string, todoId: string) {
    const todo = await this.prisma.todo.findFirst({
      where: { id: todoId, projectId },
      select: TODO_SELECT,
    })
    if (!todo) throw new NotFoundException("Todo not found")
    return toSnakeKeys<TodoRow>(todo)
  }

  async create(projectId: string, userId: string, dto: TodoBodyDto) {
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
    return toSnakeKeys<TodoRow>(todo)
  }

  async update(projectId: string, todoId: string, dto: TodoBodyDto) {
    // PUT is full-replace: omitted optional fields reset to their creation
    // defaults (the same `?? null` / `?? false` fallbacks as `create()`).
    // Scope by projectId as well as id: ProjectGuard confirms the project belongs
    // to the org, but nothing upstream ties this todo to that project, so scoping
    // here is what prevents a cross-project (cross-tenant) update via a foreign id.
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
    return toSnakeKeys<TodoRow>(todo)
  }

  async removeMany(projectId: string, ids: string[]): Promise<void> {
    await this.prisma.todo.deleteMany({ where: { projectId, id: { in: ids } } })
  }

  async removeOne(projectId: string, todoId: string): Promise<void> {
    await this.prisma.todo.deleteMany({ where: { projectId, id: todoId } })
  }
}
