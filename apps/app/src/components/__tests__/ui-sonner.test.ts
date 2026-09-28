import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const sonner = readFileSync(resolve(process.cwd(), "src/components/ui/sonner/Sonner.vue"), "utf8")
const app = readFileSync(resolve(process.cwd(), "src/App.vue"), "utf8")

describe("Toaster", () => {
  it("draws toasts on the popover surface with a large shadow", () => {
    expect(sonner).toContain("group-[.toaster]:bg-popover")
    expect(sonner).toContain("group-[.toaster]:shadow-lg")
  })

  it("uses CircleCheck in the foreground color and CircleX in the destructive color", () => {
    expect(sonner).toMatch(/<CircleCheckIcon class="size-4 text-foreground" \/>/)
    expect(sonner).toMatch(/<CircleXIcon class="size-4 text-destructive" \/>/)
  })

  it("mounts top-right with a close button and without rich colors", () => {
    expect(app).toContain('<Toaster position="top-right" close-button />')
    expect(app).not.toContain("rich-colors")
  })
})
