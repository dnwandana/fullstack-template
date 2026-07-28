/**
 * Projects store - manages project state and operations within an organization
 */

import type { Envelope, Project, Wire } from "@fullstack/contracts"
import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getProjects as apiGetProjects,
  getProject as apiGetProject,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  type ProjectInput,
} from "@/api/projects"

export const useProjectsStore = defineStore("projects", () => {
  // State
  const projects = ref<Wire<Project>[]>([])
  const currentProject = ref<Wire<Project> | null>(null)
  const loading = ref(false)

  // Actions

  /**
   * Fetch all projects for a given organization
   */
  async function fetchProjects(orgId: string): Promise<Envelope<Wire<Project>[]> | undefined> {
    loading.value = true
    try {
      const response = await apiGetProjects(orgId)
      projects.value = response.data.data
      return response.data
    } catch {
      projects.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single project by its ID within an organization
   */
  async function fetchProjectById(
    orgId: string,
    projectId: string,
  ): Promise<Envelope<Wire<Project>> | undefined> {
    loading.value = true
    try {
      const response = await apiGetProject(orgId, projectId)
      currentProject.value = response.data.data
      return response.data
    } catch {
      currentProject.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new project within an organization and refresh the list
   */
  async function createProject(
    orgId: string,
    data: ProjectInput,
  ): Promise<Envelope<Wire<Project>> | undefined> {
    loading.value = true
    try {
      const response = await apiCreateProject(orgId, data)
      message.success("Project created successfully!")
      // Refresh the list to include the newly created project
      await fetchProjects(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing project within an organization
   */
  async function updateProject(
    orgId: string,
    projectId: string,
    data: ProjectInput,
  ): Promise<Envelope<Wire<Project>> | undefined> {
    loading.value = true
    try {
      const response = await apiUpdateProject(orgId, projectId, data)
      message.success("Project updated successfully!")
      // Keep currentProject in sync with the latest data
      currentProject.value = response.data.data
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a project within an organization and refresh the list
   */
  async function deleteProject(
    orgId: string,
    projectId: string,
  ): Promise<Envelope<null> | undefined> {
    loading.value = true
    try {
      const response = await apiDeleteProject(orgId, projectId)
      message.success("Project deleted successfully!")
      // Refresh the list to remove the deleted project
      await fetchProjects(orgId)
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear the currently selected project
   * Used when navigating away from a project detail view
   */
  function clearCurrentProject(): void {
    currentProject.value = null
  }

  /**
   * Clear all project state (both list and current selection)
   * Used when switching between organizations to avoid stale data
   */
  function clearProjects(): void {
    projects.value = []
    currentProject.value = null
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    // Actions
    fetchProjects,
    fetchProjectById,
    createProject,
    updateProject,
    deleteProject,
    clearCurrentProject,
    clearProjects,
  }
})
