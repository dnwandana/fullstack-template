import { mount } from "@vue/test-utils"
import { h } from "vue"
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

function mountPagination() {
  return mount(Pagination, {
    props: { page: 2, total: 50, itemsPerPage: 10 },
    slots: {
      default: () =>
        h(PaginationContent, () => [
          h(PaginationFirst),
          h(PaginationPrevious),
          h(PaginationItem, { value: 2, isActive: true }, () => "2"),
          h(PaginationNext),
          h(PaginationLast),
        ]),
    },
  })
}

describe("Pagination edges", () => {
  it.each(["first", "previous", "next", "last"])("renders %s as a 32 px icon button", (slot) => {
    const button = mountPagination().find(`[data-slot="pagination-${slot}"]`)
    expect(button.text()).toBe("")
    expect(button.find("svg").exists()).toBe(true)
    expect(button.classes()).toContain("size-8")
  })

  it("uses the outline variant for the active page", () => {
    const item = mountPagination().find('[data-slot="pagination-item"]')
    expect(item.classes()).toContain("border-input")
  })
})
