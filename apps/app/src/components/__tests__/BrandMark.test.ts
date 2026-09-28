import { mount } from "@vue/test-utils"
import BrandMark from "@/components/BrandMark.vue"

describe("BrandMark", () => {
  it("renders the FT square and the product name", () => {
    const wrapper = mount(BrandMark)
    expect(wrapper.find('[data-slot="brand-square"]').text()).toBe("FT")
    expect(wrapper.text()).toContain("Fullstack Template")
  })

  it("renders the square only when compact", () => {
    const wrapper = mount(BrandMark, { props: { compact: true } })
    expect(wrapper.find('[data-slot="brand-square"]').exists()).toBe(true)
    expect(wrapper.text()).toBe("FT")
  })
})
