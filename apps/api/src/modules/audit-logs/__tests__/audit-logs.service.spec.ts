import { AuditLogsService } from "../audit-logs.service"
import { PaginationService } from "@shared/pagination/pagination.service"
import type { PrismaService } from "@core/database/prisma.service"
import type { ListAuditLogsDto } from "../dto/list-audit-logs.dto"

const makePrisma = () => ({
  auditLog: { count: jest.fn(), findMany: jest.fn() },
})

const makeService = (prisma: ReturnType<typeof makePrisma>) =>
  new AuditLogsService(prisma as unknown as PrismaService, new PaginationService())

const row = {
  id: "log-1",
  orgId: "org-1",
  projectId: null,
  actorId: "user-1",
  actorName: "Ada",
  actorEmail: "ada@example.com",
  action: "todo.created",
  entityType: "todo",
  entityId: "todo-1",
  entityName: "Write the spec",
  changes: null,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
}

describe("AuditLogsService.list", () => {
  it("builds a where clause from the filters", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(0)
    prisma.auditLog.findMany.mockResolvedValue([])
    await makeService(prisma).list("org-1", {
      page: 1,
      limit: 10,
      sort_order: "desc",
      project_id: "proj-1",
      action: "todo.created",
      date_from: "2026-01-01T00:00:00.000Z",
      search: "spec",
    } as ListAuditLogsDto)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          projectId: "proj-1",
          action: "todo.created",
          createdAt: expect.objectContaining({ gte: new Date("2026-01-01T00:00:00.000Z") }),
          entityName: { contains: "spec", mode: "insensitive" },
        }),
        orderBy: { createdAt: "desc" },
      }),
    )
  })

  it("omits absent filters from the where clause", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(0)
    prisma.auditLog.findMany.mockResolvedValue([])
    await makeService(prisma).list("org-1", {
      page: 1,
      limit: 10,
      sort_order: "desc",
    } as ListAuditLogsDto)
    const where = prisma.auditLog.findMany.mock.calls[0][0].where
    expect(where).toEqual({ orgId: "org-1" })
  })

  it("extends a date-only date_to bound to the end of that day", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(0)
    prisma.auditLog.findMany.mockResolvedValue([])
    await makeService(prisma).list("org-1", {
      page: 1,
      limit: 10,
      sort_order: "desc",
      date_from: "2026-08-15",
      date_to: "2026-08-15",
    } as ListAuditLogsDto)
    const where = prisma.auditLog.findMany.mock.calls[0][0].where
    expect(where.createdAt).toEqual({
      gte: new Date("2026-08-15T00:00:00.000Z"),
      lt: new Date("2026-08-16T00:00:00.000Z"),
    })
  })

  it("keeps an inclusive date_to bound when the value carries a time", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(0)
    prisma.auditLog.findMany.mockResolvedValue([])
    await makeService(prisma).list("org-1", {
      page: 1,
      limit: 10,
      sort_order: "desc",
      date_to: "2026-08-15T12:30:00.000Z",
    } as ListAuditLogsDto)
    const where = prisma.auditLog.findMany.mock.calls[0][0].where
    expect(where.createdAt).toEqual({ lte: new Date("2026-08-15T12:30:00.000Z") })
  })

  it("escapes ILIKE wildcards in the search term", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(0)
    prisma.auditLog.findMany.mockResolvedValue([])
    await makeService(prisma).list("org-1", {
      page: 1,
      limit: 10,
      sort_order: "desc",
      search: "100%_done",
    } as ListAuditLogsDto)
    const where = prisma.auditLog.findMany.mock.calls[0][0].where
    expect(where.entityName).toEqual({ contains: "100\\%\\_done", mode: "insensitive" })
  })

  it("paginates, maps the rows, and builds the meta block", async () => {
    const prisma = makePrisma()
    prisma.auditLog.count.mockResolvedValue(11)
    prisma.auditLog.findMany.mockResolvedValue([row])
    const result = await makeService(prisma).list("org-1", {
      page: 2,
      limit: 10,
      sort_order: "asc",
    } as ListAuditLogsDto)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: "asc" } }),
    )
    expect(result.data).toEqual([
      expect.objectContaining({
        id: "log-1",
        org_id: "org-1",
        actor_name: "Ada",
        entity_name: "Write the spec",
      }),
    ])
    expect(result.pagination).toEqual(
      expect.objectContaining({ current_page: 2, total_items: 11, total_pages: 2 }),
    )
  })
})
