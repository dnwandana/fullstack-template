import { mount } from "@vue/test-utils"
import PageHeader from "../PageHeader.vue"

describe("PageHeader", () => {
  it("renders the title as a heading", () => {
    const wrapper = mount(PageHeader, { props: { title: "Organizations" } })
    expect(wrapper.find("h1").text()).toBe("Organizations")
  })

  it("renders the actions slot", () => {
    const wrapper = mount(PageHeader, {
      props: { title: "Members", description: "People in Acme" },
      slots: { default: "<button>Invite Member</button>" },
    })
    expect(wrapper.find("button").text()).toBe("Invite Member")
    expect(wrapper.text()).toContain("People in Acme")
  })

  it("shows the reload spinner only while loading", async () => {
    const wrapper = mount(PageHeader, { props: { title: "Members" } })
    expect(wrapper.find('[data-slot="page-spinner"]').exists()).toBe(false)
    await wrapper.setProps({ loading: true })
    expect(wrapper.find('[data-slot="page-spinner"]').exists()).toBe(true)
  })

  it("lets the actions wrap", () => {
    const wrapper = mount(PageHeader, { props: { title: "Todos" }, slots: { default: "<b>x</b>" } })
    expect(wrapper.find('[data-slot="page-actions"]').classes()).toContain("flex-wrap")
  })
})
