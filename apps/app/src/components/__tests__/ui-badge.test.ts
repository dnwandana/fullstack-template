import { mount } from "@vue/test-utils"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })
})

describe("Badge status variants", () => {
  it.each([
    ["success", "bg-success"],
    ["warning", "bg-warning"],
    ["info", "bg-info"],
  ] as const)("renders the %s variant", (variant, klass) => {
    expect(badgeVariants({ variant })).toContain(klass)
    const wrapper = mount(Badge, { props: { variant }, slots: { default: "x" } })
    expect(wrapper.classes()).toContain(klass)
    expect(wrapper.classes()).toContain(`text-${variant}-foreground`)
  })
})

describe("Badge shape", () => {
  it("renders a 6 px radius with 12 px text and a data-slot", () => {
    const wrapper = mount(Badge, { slots: { default: "x" } })
    expect(wrapper.attributes("data-slot")).toBe("badge")
    expect(wrapper.classes()).toEqual(expect.arrayContaining(["rounded-md", "text-xs"]))
    expect(wrapper.classes()).not.toContain("rounded-full")
  })

  it("renders destructive as a soft fill with destructive text", () => {
    const wrapper = mount(Badge, { props: { variant: "destructive" }, slots: { default: "x" } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-destructive/10", "text-destructive"]),
    )
  })

  it("gives secondary a border", () => {
    const wrapper = mount(Badge, { props: { variant: "secondary" }, slots: { default: "x" } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(["bg-secondary", "border-border"]))
  })
})
