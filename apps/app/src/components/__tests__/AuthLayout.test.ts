import { mount } from "@vue/test-utils"
import AuthLayout from "@/components/AuthLayout.vue"

describe("AuthLayout", () => {
  it("renders the brand above a 400 px column on the muted background", () => {
    const wrapper = mount(AuthLayout, { slots: { default: "<p>card</p>" } })
    expect(wrapper.find('[data-slot="auth-layout"]').classes()).toContain("bg-muted")
    expect(wrapper.find('[data-slot="brand-mark"]').exists()).toBe(true)
    const card = wrapper.find('[data-slot="auth-card"]')
    expect(card.classes()).toContain("w-[min(400px,calc(100%-32px))]")
    expect(card.text()).toBe("card")
  })

  it("makes the column 460 px wide with the wide prop", () => {
    const wrapper = mount(AuthLayout, { props: { wide: true } })
    expect(wrapper.find('[data-slot="auth-card"]').classes()).toContain(
      "w-[min(460px,calc(100%-32px))]",
    )
  })
})
