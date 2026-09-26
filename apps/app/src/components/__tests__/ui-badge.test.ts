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
