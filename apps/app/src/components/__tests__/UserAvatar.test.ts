import { mount } from "@vue/test-utils"
import UserAvatar from "@/components/UserAvatar.vue"

describe("UserAvatar", () => {
  it("shows the upper-case first letter of the name", () => {
    expect(mount(UserAvatar, { props: { name: "ada Lovelace" } }).text()).toBe("A")
  })

  it.each([null, undefined, "", "   "])("shows a question mark for %o", (name) => {
    expect(mount(UserAvatar, { props: { name } }).text()).toBe("?")
  })

  it("renders a muted circle by default", () => {
    const classes = mount(UserAvatar, { props: { name: "Ada" } }).classes()
    expect(classes).toEqual(expect.arrayContaining(["rounded-full", "bg-muted", "size-7"]))
  })

  it("renders a primary square for an org", () => {
    const wrapper = mount(UserAvatar, { props: { name: "Acme", shape: "square", size: 40 } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["rounded-md", "bg-primary", "size-10"]),
    )
  })

  it("is hidden from assistive technology", () => {
    expect(mount(UserAvatar, { props: { name: "Ada" } }).attributes("aria-hidden")).toBe("true")
  })
})
