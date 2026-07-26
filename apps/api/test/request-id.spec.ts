import { buildPinoHttpOptions } from "../src/config/pino.config"

function genId(incoming?: string): string {
  const options = buildPinoHttpOptions()
  const req = { headers: incoming === undefined ? {} : { "x-request-id": incoming } }
  const res = { setHeader: jest.fn() }
  return (options.genReqId as unknown as (r: unknown, s: unknown) => string)(req, res)
}

describe("genReqId", () => {
  it("keeps an nginx-style 32-hex id", () => {
    const nginxId = "3a7f1c9e2b4d6a8f0c1e3d5b7a9f2c4e"
    expect(genId(nginxId)).toBe(nginxId)
  })

  it("keeps a dashed uuid", () => {
    const uuid = "5f2b8c1e-4d7a-4b3c-9e1f-0a2b3c4d5e6f"
    expect(genId(uuid)).toBe(uuid)
  })

  it.each([
    "not-an-id",
    "3a7f1c9e2b4d6a8f0c1e3d5b7a9f2c4", // 31 chars
    "3a7f1c9e2b4d6a8f0c1e3d5b7a9f2c4ee", // 33 chars
    "3a7f1c9e-2b4d6a8f0c1e3d5b7a9f2c4e", // half-dashed
    "5f2b8c1e-4d7a-4b3c-9e1f-0a2b3c4d5e6f\ninjected",
  ])("replaces the invalid id %j", (bad) => {
    expect(genId(bad)).not.toBe(bad)
  })

  it("mints an id when none is supplied", () => {
    expect(genId()).toMatch(/^[0-9a-f-]{36}$/i)
  })
})
