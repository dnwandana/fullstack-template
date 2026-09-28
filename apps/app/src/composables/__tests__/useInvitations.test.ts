import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import type { InvitationListItem, Wire } from "@fullstack/contracts"
import { toast } from "vue-sonner"
import { ok, okPaginated, makeInvitationWithToken } from "@/test/fixtures"
import { request } from "@/utils/http"
import { useInvitations } from "../useInvitations"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const INPUT = { email: "a@test.com", role_id: "role-1" }

describe("useInvitations", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(request.get).mockResolvedValue(okPaginated<Wire<InvitationListItem>>([]))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns the accept url from a project invite", async () => {
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/i" })),
    )
    const { handleInvite } = useInvitations()
    await expect(handleInvite("org-1", INPUT, "project", "proj-1")).resolves.toBe("http://test/i")
    expect(request.post).toHaveBeenCalledWith("/orgs/org-1/projects/proj-1/invitations", INPUT)
  })

  it("resolves null when the invite fails", async () => {
    vi.mocked(request.post).mockRejectedValue(new Error("409"))
    const { handleInvite } = useInvitations()
    await expect(handleInvite("org-1", INPUT, "org")).resolves.toBeNull()
  })

  it("keeps the modal open with the link after an invite, and clears it on the next open", async () => {
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/i" })),
    )
    const { openInviteModal, handleInvite, isInviteModalVisible, inviteUrl } = useInvitations()
    openInviteModal()
    await handleInvite("org-1", INPUT, "org")
    expect(isInviteModalVisible.value).toBe(true)
    expect(inviteUrl.value).toBe("http://test/i")
    openInviteModal()
    expect(inviteUrl.value).toBeNull()
  })

  it("opens the link dialog only when the copy fails, and keeps the link on close", async () => {
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/n" })),
    )
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    const { handleNewLink, closeNewLink, isNewLinkVisible, newLinkUrl } = useInvitations()
    await handleNewLink("org-1", "inv-1")
    expect(request.post).toHaveBeenCalledWith("/orgs/org-1/invitations/inv-1/resend")
    expect(isNewLinkVisible.value).toBe(true)
    expect(newLinkUrl.value).toBe("http://test/n")
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    closeNewLink()
    expect(isNewLinkVisible.value).toBe(false)
    expect(newLinkUrl.value).toBe("http://test/n")
  })

  it("copies the new link with one toast and no dialog", async () => {
    vi.mocked(request.post).mockResolvedValue(
      ok(makeInvitationWithToken({ accept_url: "http://test/n" })),
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const { handleNewLink, isNewLinkVisible } = useInvitations()
    await handleNewLink("org-1", "inv-1")
    expect(writeText).toHaveBeenCalledWith("http://test/n")
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(isNewLinkVisible.value).toBe(false)
  })

  it("does not copy or open the dialog when the resend fails", async () => {
    vi.mocked(request.post).mockRejectedValue(new Error("409"))
    const writeText = vi.fn()
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const { handleNewLink, isNewLinkVisible } = useInvitations()
    await handleNewLink("org-1", "inv-1")
    expect(writeText).not.toHaveBeenCalled()
    expect(isNewLinkVisible.value).toBe(false)
  })
})
