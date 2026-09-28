import { mount } from "@vue/test-utils"
import { h } from "vue"
import { Table, TableBody } from "@/components/ui/table"
import TableSkeletonRows, { type SkeletonColumn } from "@/components/TableSkeletonRows.vue"

function mountRows(columns: SkeletonColumn[], rows?: number) {
  return mount(Table, {
    slots: { default: () => h(TableBody, () => h(TableSkeletonRows, { columns, rows })) },
  })
}

describe("TableSkeletonRows", () => {
  it("renders five rows by default, one cell per column", () => {
    const wrapper = mountRows([{ width: 140 }, { width: 80 }, {}])
    expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(5)
    expect(wrapper.findAll('[data-slot="skeleton-row"]')[0]?.findAll("td")).toHaveLength(3)
  })

  it("honors the row count", () => {
    expect(mountRows([{}], 3).findAll('[data-slot="skeleton-row"]')).toHaveLength(3)
  })

  it("sets the bar width in pixels", () => {
    const bar = mountRows([{ width: 140 }], 1).find('[data-slot="skeleton-bar"]')
    expect(bar.attributes("style")).toContain("width: 140px")
  })

  it("draws a round or square avatar before the bar", () => {
    const wrapper = mountRows([{ avatar: "circle" }, { avatar: "square" }], 1)
    const cells = wrapper.findAll("td")
    expect(cells[0]?.find(".rounded-full").exists()).toBe(true)
    expect(cells[1]?.find(".size-6.rounded-md").exists()).toBe(true)
  })
})
