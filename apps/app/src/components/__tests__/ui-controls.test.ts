import { mount } from "@vue/test-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { h } from "vue"

function buttonClass(props: Record<string, string>): string {
  return mount(Button, { props, slots: { default: () => "Go" } })
    .find("button")
    .classes()
    .join(" ")
}

describe("Button sizes", () => {
  it.each([
    [{}, "h-9"],
    [{ size: "sm" }, "h-8"],
    [{ size: "lg" }, "h-10"],
    [{ size: "icon" }, "size-9"],
    [{ size: "icon-sm" }, "size-8"],
  ])("renders %o with %s", (props, expected) => {
    expect(buttonClass(props)).toContain(expected)
  })

  it("draws the link variant in the link color with an underline on hover only", () => {
    const classes = buttonClass({ variant: "link" })
    expect(classes).toContain("text-link")
    expect(classes).toContain("font-medium")
    expect(classes).toContain("hover:underline")
    expect(classes).not.toMatch(/(^| )underline( |$)/)
  })
})

describe("field sizes", () => {
  it("renders the input at 36 px with the 3 px focus ring", () => {
    const classes = mount(Input).find("input").classes()
    expect(classes).toContain("h-9")
    expect(classes).toContain("focus-visible:ring-[3px]")
    expect(classes).toContain("focus-visible:ring-ring/22")
    expect(classes).not.toContain("focus-visible:ring-offset-2")
  })

  it("gives the textarea the same focus ring", () => {
    expect(mount(Textarea).find("textarea").classes()).toContain("focus-visible:ring-[3px]")
  })

  it("renders the select trigger at 36 px", () => {
    const wrapper = mount(Select, {
      slots: { default: () => h(SelectTrigger, () => h(SelectValue)) },
    })
    expect(wrapper.find("button").classes()).toContain("h-9")
  })
})
