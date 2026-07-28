/**
 * Todos API service
 * Handles all CRUD operations for todos within a project (multi-tenant)
 * All endpoints are scoped under /orgs/{orgId}/projects/{projectId}/todos
 */

import type { Envelope, PaginatedEnvelope, Todo, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/**
 * Query params accepted by the todo list endpoint. Declared as `type`, not `interface`, so it
 * satisfies the index signature `QueryParams` requires — TypeScript grants an implicit index
 * signature to object type aliases but not to interface declarations.
 *
 * Server-side defaults: `page` 1, `limit` 10, `sort_by` `updated_at` (or `title`), `sort_order`
 * `desc`. `search` filters by title, case-insensitive, max 255 chars.
 */
export type TodoListParams = {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: string
  search?: string
}

/** The body `createTodo` and `updateTodo` send. */
export type TodoInput = {
  title: string
  description?: string
  is_completed?: boolean
}

/** Build the base URL for todos scoped to an organization and project. */
function basePath(orgId: string, projectId: string): string {
  return `/orgs/${orgId}/projects/${projectId}/todos`
}

/** Get paginated list of todos for a project. */
export function getTodos(
  orgId: string,
  projectId: string,
  params: TodoListParams = {},
): Promise<HttpResult<PaginatedEnvelope<Wire<Todo>[]>>> {
  return request.get<PaginatedEnvelope<Wire<Todo>[]>>(basePath(orgId, projectId), params)
}

/** Get a single todo by ID. */
export function getTodoById(
  orgId: string,
  projectId: string,
  todoId: string,
): Promise<HttpResult<Envelope<Wire<Todo>>>> {
  return request.get<Envelope<Wire<Todo>>>(`${basePath(orgId, projectId)}/${todoId}`)
}

/** Create a new todo within a project. */
export function createTodo(
  orgId: string,
  projectId: string,
  data: TodoInput,
): Promise<HttpResult<Envelope<Wire<Todo>>>> {
  return request.post<Envelope<Wire<Todo>>>(basePath(orgId, projectId), data)
}

/** Update an existing todo. */
export function updateTodo(
  orgId: string,
  projectId: string,
  todoId: string,
  data: TodoInput,
): Promise<HttpResult<Envelope<Wire<Todo>>>> {
  return request.put<Envelope<Wire<Todo>>>(`${basePath(orgId, projectId)}/${todoId}`, data)
}

/** Delete a single todo. */
export function deleteTodo(
  orgId: string,
  projectId: string,
  todoId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`${basePath(orgId, projectId)}/${todoId}`)
}

/** Delete multiple todos. */
export function deleteTodos(
  orgId: string,
  projectId: string,
  ids: string[],
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(basePath(orgId, projectId), { ids: ids.join(",") })
}
