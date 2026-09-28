import { mount } from "@vue/test-utils"
import { h } from "vue"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

function mountEmpty() {
  return mount(Empty, {
    slots: {
      default: () =>
        h(EmptyHeader, () => [
          h(EmptyMedia, { variant: "icon" }, () => h("svg")),
          h(EmptyTitle, () => "No members"),
        ]),
    },
  })
}

describe("Empty", () => {
  it("draws a dashed border", () => {
    expect(mountEmpty().classes()).toEqual(expect.arrayContaining(["border", "border-dashed"]))
  })

  it("renders the title at 15 px in weight 600", () => {
    const title = mountEmpty().find('[data-slot="empty-title"]')
    expect(title.classes()).toEqual(expect.arrayContaining(["text-[15px]", "font-semibold"]))
  })

  it("renders the icon tile as a 40 px muted square with a border", () => {
    const tile = mountEmpty().find('[data-slot="empty-icon"]')
    expect(tile.classes()).toEqual(expect.arrayContaining(["size-10", "bg-muted", "border"]))
  })
})
