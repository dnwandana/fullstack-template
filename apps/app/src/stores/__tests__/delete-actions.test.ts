import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { request } from "@/utils/http"

// The stores import tenant.ts, which reads the router singleton. See stores/tenant.test.ts.
const { currentRoute } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { currentRoute: ref({ params: { orgId: "o1" } }) }
})
vi.mock("@/router", () => ({ default: { currentRoute } }))

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "vue-sonner"
import { useOrgsStore } from "../orgs"
import { useProjectsStore } from "../projects"
import { useRolesStore } from "../roles"
import { useMembersStore } from "../members"
import { useInvitationsStore } from "../invitations"

const ACTIONS: [string, () => Promise<unknown>][] = [
  ["deleteOrg", () => useOrgsStore().deleteOrg("o1")],
  ["deleteProject", () => useProjectsStore().deleteProject("o1", "p1")],
  ["deleteRole", () => useRolesStore().deleteRole("o1", "r1")],
  ["removeOrgMember", () => useMembersStore().removeOrgMember("o1", "u2")],
  ["removeProjectMember", () => useMembersStore().removeProjectMember("o1", "p1", "u2")],
  ["revokeInvitation", () => useInvitationsStore().revokeInvitation("o1", "i1")],
  ["declineInvitation", () => useInvitationsStore().declineInvitation("i1")],
]

describe("store actions behind a confirm dialog", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(toast.success).mockReset()
    vi.mocked(request.del).mockReset().mockRejectedValue(new Error("409"))
    vi.mocked(request.post).mockReset().mockRejectedValue(new Error("409"))
  })

  it.each(ACTIONS)("%s rejects when the request fails", async (_name, run) => {
    await expect(run()).rejects.toThrow("409")
    expect(toast.success).not.toHaveBeenCalled()
  })
})
