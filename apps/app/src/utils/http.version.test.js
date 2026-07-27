import { describe, expect, it } from "vitest"
import { baseURL } from "./http"

describe("baseURL", () => {
  it("carries the API version segment", () => {
    expect(baseURL).toMatch(/\/v1$/)
  })

  it("appends the version to the configured origin, not replaces it", () => {
    expect(baseURL).toBe(`${import.meta.env.VITE_API_BASE_URL}/v1`)
  })
})
