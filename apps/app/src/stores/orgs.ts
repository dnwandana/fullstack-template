/**
 * Organizations store - manages organization state and operations
 */

import type { Envelope, Org, Wire } from "@fullstack/contracts"
import { defineStore } from "pinia"
import { ref } from "vue"
import { message } from "ant-design-vue"
import {
  getOrgs as apiGetOrgs,
  getOrg as apiGetOrg,
  createOrg as apiCreateOrg,
  updateOrg as apiUpdateOrg,
  deleteOrg as apiDeleteOrg,
  type OrgInput,
} from "@/api/orgs"

export const useOrgsStore = defineStore("orgs", () => {
  // State
  const orgs = ref<Wire<Org>[]>([])
  const currentOrg = ref<Wire<Org> | null>(null)
  const loading = ref(false)

  // Actions

  /**
   * Fetch all organizations the current user belongs to
   */
  async function fetchOrgs(): Promise<Envelope<Wire<Org>[]> | undefined> {
    loading.value = true
    try {
      const response = await apiGetOrgs()
      orgs.value = response.data.data
      return response.data
    } catch {
      orgs.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single organization by its ID
   */
  async function fetchOrgById(orgId: string): Promise<Envelope<Wire<Org>> | undefined> {
    loading.value = true
    try {
      const response = await apiGetOrg(orgId)
      currentOrg.value = response.data.data
      return response.data
    } catch {
      currentOrg.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new organization and refresh the list
   */
  async function createOrg(data: OrgInput): Promise<Envelope<Wire<Org>> | undefined> {
    loading.value = true
    try {
      const response = await apiCreateOrg(data)
      message.success("Organization created successfully!")
      // Refresh the list to include the newly created org
      await fetchOrgs()
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing organization
   */
  async function updateOrg(
    orgId: string,
    data: OrgInput,
  ): Promise<Envelope<Wire<Org>> | undefined> {
    loading.value = true
    try {
      const response = await apiUpdateOrg(orgId, data)
      message.success("Organization updated successfully!")
      // Keep currentOrg in sync with the latest data
      currentOrg.value = response.data.data
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete an organization and refresh the list
   */
  async function deleteOrg(orgId: string): Promise<Envelope<null> | undefined> {
    loading.value = true
    try {
      const response = await apiDeleteOrg(orgId)
      message.success("Organization deleted successfully!")
      // Refresh the list to remove the deleted org
      await fetchOrgs()
      return response.data
    } catch {
      // Axios interceptor handles error display
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear the currently selected organization
   * Used when navigating away from an org detail view
   */
  function clearCurrentOrg(): void {
    currentOrg.value = null
  }

  return {
    // State
    orgs,
    currentOrg,
    loading,
    // Actions
    fetchOrgs,
    fetchOrgById,
    createOrg,
    updateOrg,
    deleteOrg,
    clearCurrentOrg,
  }
})
