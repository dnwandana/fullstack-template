import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8")

describe("index.html", () => {
  it("sets the dark class before the app script loads", () => {
    const inline = html.indexOf('localStorage.getItem("ui.theme")')
    expect(inline).toBeGreaterThan(-1)
    expect(html).toContain("(prefers-color-scheme: dark)")
    expect(html).toContain('classList.add("dark")')
    expect(inline).toBeLessThan(html.indexOf("/src/main.ts"))
  })
})
