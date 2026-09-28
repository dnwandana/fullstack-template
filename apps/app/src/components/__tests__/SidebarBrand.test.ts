import { mount } from "@vue/test-utils"
import { h } from "vue"
import { SidebarProvider } from "@/components/ui/sidebar"
import SidebarBrand from "@/components/SidebarBrand.vue"

function mountBrand(open: boolean) {
  return mount(SidebarProvider, { props: { open }, slots: { default: () => h(SidebarBrand) } })
}

describe("SidebarBrand", () => {
  it("shows the full brand mark when the sidebar is open", () => {
    const brand = mountBrand(true).find('[data-slot="sidebar-brand"]')
    expect(brand.text()).toContain("Fullstack Template")
    expect(brand.classes()).toEqual(expect.arrayContaining(["h-14", "border-b"]))
  })

  it("shows only the FT square in rail mode", () => {
    expect(mountBrand(false).find('[data-slot="sidebar-brand"]').text()).toBe("FT")
  })
})
