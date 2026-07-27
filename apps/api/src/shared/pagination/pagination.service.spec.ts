import { PaginationService } from "./pagination.service"
import { isUuid } from "../utils/uuid"

describe("PaginationService.buildMeta", () => {
  const svc = new PaginationService()

  it("builds a middle-page meta object", () => {
    expect(svc.buildMeta(2, 10, 35)).toEqual({
      current_page: 2,
      total_pages: 4,
      total_items: 35,
      items_per_page: 10,
      has_next_page: true,
      has_previous_page: true,
      next_page: 3,
      previous_page: 1,
    })
  })

  it("clamps next/previous at the edges", () => {
    expect(svc.buildMeta(1, 10, 5)).toMatchObject({
      total_pages: 1,
      has_next_page: false,
      has_previous_page: false,
      next_page: null,
      previous_page: null,
    })
    expect(svc.buildMeta(1, 10, 0)).toMatchObject({
      total_pages: 0,
      total_items: 0,
      next_page: null,
      previous_page: null,
    })
  })
})

describe("isUuid", () => {
  it("accepts a canonical uuid and rejects junk", () => {
    expect(isUuid("11111111-1111-1111-1111-111111111111")).toBe(true)
    expect(isUuid("not-a-uuid")).toBe(false)
  })
})
