import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "vue-sonner"
import { copyInviteLink } from "../clipboard"

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("copyInviteLink", () => {
  it("copies the link and shows the success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    await expect(copyInviteLink("http://test/i")).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith("http://test/i")
    expect(toast.success).toHaveBeenCalledWith("Invitation link copied to clipboard")
  })

  it.each([
    ["refuses", () => ({ writeText: vi.fn().mockRejectedValue(new Error("denied")) })],
    ["is missing", () => undefined],
  ])("shows the error toast when the clipboard %s", async (_case, clipboard) => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: clipboard() })
    await expect(copyInviteLink("http://test/i")).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Copy failed. Select the link and copy it by hand.")
    expect(toast.success).not.toHaveBeenCalled()
  })
})
