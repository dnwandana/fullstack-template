/**
 * Projects API service
 * Handles CRUD operations for projects within an organization
 */

import type { Envelope, Project, Wire } from "@fullstack/contracts"
import { request, type HttpResult } from "@/utils/http"

/** The body `createProject` and `updateProject` send. Mirrors the API's `CreateProjectDto`. */
export interface ProjectInput {
  name: string
  description?: string
}

/**
 * Get list of projects for an organization
 */
export function getProjects(orgId: string): Promise<HttpResult<Envelope<Wire<Project>[]>>> {
  return request.get<Envelope<Wire<Project>[]>>(`/orgs/${orgId}/projects`)
}

/**
 * Get a single project by ID
 */
export function getProject(
  orgId: string,
  projectId: string,
): Promise<HttpResult<Envelope<Wire<Project>>>> {
  return request.get<Envelope<Wire<Project>>>(`/orgs/${orgId}/projects/${projectId}`)
}

/**
 * Create a new project within an organization
 */
export function createProject(
  orgId: string,
  data: ProjectInput,
): Promise<HttpResult<Envelope<Wire<Project>>>> {
  return request.post<Envelope<Wire<Project>>>(`/orgs/${orgId}/projects`, data)
}

/**
 * Update an existing project
 */
export function updateProject(
  orgId: string,
  projectId: string,
  data: ProjectInput,
): Promise<HttpResult<Envelope<Wire<Project>>>> {
  return request.put<Envelope<Wire<Project>>>(`/orgs/${orgId}/projects/${projectId}`, data)
}

/**
 * Delete a project
 */
export function deleteProject(
  orgId: string,
  projectId: string,
): Promise<HttpResult<Envelope<null>>> {
  return request.del<Envelope<null>>(`/orgs/${orgId}/projects/${projectId}`)
}
