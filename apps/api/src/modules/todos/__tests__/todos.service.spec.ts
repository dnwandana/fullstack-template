import { TodosService } from "../todos.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { PaginationService } from "@shared/pagination/pagination.service"
import type { AuditService } from "@core/audit/audit.service"
import type { TodoRow } from "../todo-row"

const makeRow = (overrides: Partial<TodoRow> = {}): TodoRow => ({
  id: "todo-1",
  projectId: "proj-1",
  userId: "user-1",
  title: "Write the spec",
  description: null,
  isCompleted: false,
  createdAt: new Date("2026-08-15T00:00:00Z"),
  updatedAt: new Date("2026-08-15T00:00:00Z"),
  ...overrides,
})

const makePrisma = () => ({
  todo: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
})

const pagination = { buildMeta: jest.fn() }

describe("TodosService audit capture", () => {
  let prisma: ReturnType<typeof makePrisma>
  let audit: { record: jest.Mock }
  let service: TodosService

  beforeEach(() => {
    prisma = makePrisma()
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    service = new TodosService(
      prisma as unknown as PrismaService,
      pagination as unknown as PaginationService,
      audit as unknown as AuditService,
    )
  })

  it("records todo.created", async () => {
    prisma.todo.create.mockResolvedValue(makeRow())
    await service.create("org-1", "proj-1", "user-1", { title: "Write the spec" })
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "todo.created",
        entityType: "todo",
        orgId: "org-1",
        projectId: "proj-1",
        actorId: "user-1",
        entityName: "Write the spec",
      }),
    )
  })

  it("records todo.updated with a snake_case diff", async () => {
    prisma.todo.findFirst.mockResolvedValue(makeRow({ isCompleted: false }))
    prisma.todo.updateMany.mockResolvedValue({ count: 1 })
    prisma.todo.findUniqueOrThrow.mockResolvedValue(makeRow({ isCompleted: true }))
    await service.update("org-1", "proj-1", "user-1", "todo-1", {
      title: "Write the spec",
      is_completed: true,
    })
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "todo.updated",
        changes: expect.objectContaining({ is_completed: { from: false, to: true } }),
      }),
    )
  })

  it("records one todo.deleted per bulk-deleted todo", async () => {
    prisma.todo.findMany.mockResolvedValue([
      { id: "t1", title: "A" },
      { id: "t2", title: "B" },
    ])
    prisma.todo.deleteMany.mockResolvedValue({ count: 2 })
    await service.removeMany("org-1", "proj-1", "user-1", ["t1", "t2"])
    expect(audit.record).toHaveBeenCalledTimes(2)
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "todo.deleted", entityId: "t1", entityName: "A" }),
    )
  })

  it("records todo.deleted when the single delete removes a row", async () => {
    prisma.todo.findFirst.mockResolvedValue({ id: "todo-1", title: "Write the spec" })
    prisma.todo.deleteMany.mockResolvedValue({ count: 1 })
    await service.removeOne("org-1", "proj-1", "user-1", "todo-1")
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "todo.deleted",
        entityType: "todo",
        entityId: "todo-1",
        entityName: "Write the spec",
      }),
    )
  })

  it("records nothing when the single delete matches no row", async () => {
    prisma.todo.findFirst.mockResolvedValue(null)
    prisma.todo.deleteMany.mockResolvedValue({ count: 0 })
    await service.removeOne("org-1", "proj-1", "user-1", "todo-1")
    expect(audit.record).not.toHaveBeenCalled()
  })
})
