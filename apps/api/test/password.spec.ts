import { PasswordService } from "../src/auth/password.service"

describe("PasswordService", () => {
  let svc: PasswordService
  beforeAll(async () => {
    svc = new PasswordService()
    await svc.onModuleInit()
  })

  it("hashes and verifies a password", async () => {
    const h = await svc.hash("Str0ng!pass")
    expect(await svc.verify(h, "Str0ng!pass")).toBe(true)
    expect(await svc.verify(h, "wrong")).toBe(false)
  })

  it("exposes a usable dummy hash for timing-safe checks", async () => {
    expect(typeof svc.dummyHash).toBe("string")
    expect(await svc.verify(svc.dummyHash, "anything")).toBe(false)
  })
})
