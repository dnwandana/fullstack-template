import { createPinia, setActivePinia } from "pinia"
import { useInvitationsStore } from "@/stores/invitations"
import { request } from "@/utils/http"

vi.mock("@/utils/http", () => ({
  baseURL: "http://test/api",
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

vi.mock("ant-design-vue", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}))

describe("invitations store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("sends the raw token in the accept request body", async () => {
    vi.mocked(request.post).mockResolvedValue({ data: { data: null }, status: 200 })
    vi.mocked(request.get).mockResolvedValue({ data: { data: [] }, status: 200 })

    const store = useInvitationsStore()
    await store.acceptInvitation("inv-1", "a".repeat(64))

    expect(request.post).toHaveBeenCalledWith("/invitations/inv-1/accept", {
      token: "a".repeat(64),
    })
  })

  it("passes the token as a query param when previewing", async () => {
    vi.mocked(request.get).mockResolvedValue({ data: { data: { org_name: "Acme" } }, status: 200 })

    const store = useInvitationsStore()
    const preview = await store.previewInvitation("inv-1", "b".repeat(64))

    expect(request.get).toHaveBeenCalledWith("/invitations/inv-1/preview", {
      token: "b".repeat(64),
    })
    expect(preview?.org_name).toBe("Acme")
  })

  it("returns null when the preview request fails", async () => {
    vi.mocked(request.get).mockRejectedValue(new Error("404"))

    const store = useInvitationsStore()
    const preview = await store.previewInvitation("inv-1", "c".repeat(64))

    expect(preview).toBeNull()
  })

  it("captures the accept url returned when inviting to an org", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: { data: { id: "inv-1", accept_url: "http://test/invite/inv-1?token=x" } },
      status: 200,
    })
    vi.mocked(request.get).mockResolvedValue({ data: { data: [] }, status: 200 })

    const store = useInvitationsStore()
    await store.inviteToOrg("org-1", { email: "a@test.com", role_id: "role-1" })

    expect(store.lastAcceptUrl).toBe("http://test/invite/inv-1?token=x")
  })

  it("captures the accept url returned when inviting to a project", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: { data: { id: "inv-2", accept_url: "http://test/invite/inv-2?token=y" } },
      status: 200,
    })
    vi.mocked(request.get).mockResolvedValue({ data: { data: [] }, status: 200 })

    const store = useInvitationsStore()
    await store.inviteToProject("org-1", "proj-1", { email: "b@test.com", role_id: "role-1" })

    expect(store.lastAcceptUrl).toBe("http://test/invite/inv-2?token=y")
  })

  it("resends an invitation and returns the fresh link", async () => {
    vi.mocked(request.post).mockResolvedValue({
      data: {
        data: { id: "inv-1", token: "d".repeat(64), accept_url: "http://test/invite/inv-1" },
      },
      status: 200,
    })
    vi.mocked(request.get).mockResolvedValue({ data: { data: [] }, status: 200 })

    const store = useInvitationsStore()
    const result = await store.resendInvitation("org-1", "inv-1")

    expect(request.post).toHaveBeenCalledWith("/orgs/org-1/invitations/inv-1/resend")
    expect(result?.accept_url).toBe("http://test/invite/inv-1")
  })

  it("returns null when a resend fails", async () => {
    vi.mocked(request.post).mockRejectedValue(new Error("400"))

    const store = useInvitationsStore()
    const result = await store.resendInvitation("org-1", "inv-1")

    expect(result).toBeNull()
  })
})
