import { validatePaginationQuery, buildPaginationMeta } from "../../src/utils/pagination.js"

describe("validatePaginationQuery", () => {
  const sortableColumns = ["updated_at", "title"]

  it("should return defaults when no query params provided", () => {
    const result = validatePaginationQuery({}, sortableColumns)
    expect(result).toEqual({
      page: 1,
      limit: 10,
      sort_by: "updated_at",
      sort_order: "desc",
      search: "",
    })
  })

  it("should accept valid custom values", () => {
    const query = { page: 2, limit: 25, sort_by: "title", sort_order: "asc", search: "buy" }
    const result = validatePaginationQuery(query, sortableColumns)
    expect(result).toEqual({
      page: 2,
      limit: 25,
      sort_by: "title",
      sort_order: "asc",
      search: "buy",
    })
  })

  it("should throw HttpError for page less than 1", () => {
    expect(() => validatePaginationQuery({ page: 0 }, sortableColumns)).toThrow()
  })

  it("should throw HttpError for limit greater than 100", () => {
    expect(() => validatePaginationQuery({ limit: 101 }, sortableColumns)).toThrow()
  })

  it("should throw HttpError for invalid sort_by column", () => {
    expect(() => validatePaginationQuery({ sort_by: "invalid" }, sortableColumns)).toThrow()
  })

  it("should throw HttpError for invalid sort_order", () => {
    expect(() => validatePaginationQuery({ sort_order: "sideways" }, sortableColumns)).toThrow()
  })
})

describe("buildPaginationMeta", () => {
  it("should calculate pagination for first page of multiple", () => {
    const meta = buildPaginationMeta(1, 10, 25)
    expect(meta).toEqual({
      current_page: 1,
      total_pages: 3,
      total_items: 25,
      items_per_page: 10,
      has_next_page: true,
      has_previous_page: false,
      next_page: 2,
      previous_page: null,
    })
  })

  it("should calculate pagination for middle page", () => {
    const meta = buildPaginationMeta(2, 10, 25)
    expect(meta.has_next_page).toBe(true)
    expect(meta.has_previous_page).toBe(true)
    expect(meta.next_page).toBe(3)
    expect(meta.previous_page).toBe(1)
  })

  it("should calculate pagination for last page", () => {
    const meta = buildPaginationMeta(3, 10, 25)
    expect(meta.has_next_page).toBe(false)
    expect(meta.has_previous_page).toBe(true)
    expect(meta.next_page).toBeNull()
    expect(meta.previous_page).toBe(2)
  })

  it("should handle zero total items", () => {
    const meta = buildPaginationMeta(1, 10, 0)
    expect(meta.total_pages).toBe(0)
    expect(meta.has_next_page).toBe(false)
    expect(meta.has_previous_page).toBe(false)
  })

  it("should handle single page", () => {
    const meta = buildPaginationMeta(1, 10, 5)
    expect(meta.total_pages).toBe(1)
    expect(meta.has_next_page).toBe(false)
    expect(meta.has_previous_page).toBe(false)
  })
})
