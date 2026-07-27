import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/utils/http", () => ({
  request: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), send: vi.fn() },
}))

import { request } from "@/utils/http"
import { createRole, updateRole } from "./roles"

describe("roles api — permissions → permission_ids remap (contract gap)", () => {
  beforeEach(() => {
    request.post.mockReset().mockResolvedValue({ data: { data: {} } })
    request.put.mockReset().mockResolvedValue({ data: { data: {} } })
  })

  it("createRole sends permission_ids instead of permissions", async () => {
    await createRole("org-1", {
      name: "Dev",
      description: "d",
      permissions: ["uuid-a", "uuid-b"],
    })

    expect(request.post).toHaveBeenCalledWith("/orgs/org-1/roles", {
      name: "Dev",
      description: "d",
      permission_ids: ["uuid-a", "uuid-b"],
    })
    const body = request.post.mock.calls[0][1]
    expect(body).not.toHaveProperty("permissions")
  })

  it("updateRole sends permission_ids instead of permissions", async () => {
    await updateRole("org-1", "role-1", {
      name: "Dev",
      description: "d",
      permissions: ["uuid-a", "uuid-b"],
    })

    expect(request.put).toHaveBeenCalledWith("/orgs/org-1/roles/role-1", {
      name: "Dev",
      description: "d",
      permission_ids: ["uuid-a", "uuid-b"],
    })
    const body = request.put.mock.calls[0][1]
    expect(body).not.toHaveProperty("permissions")
  })

  it("omits permission_ids entirely when permissions is not provided", async () => {
    await createRole("org-1", { name: "Dev" })

    const body = request.post.mock.calls[0][1]
    expect(body).not.toHaveProperty("permission_ids")
    expect(body).not.toHaveProperty("permissions")
  })
})
