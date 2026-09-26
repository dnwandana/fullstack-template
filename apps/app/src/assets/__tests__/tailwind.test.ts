import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// The jsdom environment gives `import.meta.url` a non-file scheme. Vitest runs
// from `apps/app`, so the path resolves from the working directory.
export const css = readFileSync(resolve(process.cwd(), "src/assets/tailwind.css"), "utf8")

describe("tailwind.css", () => {
  it("imports tailwind first", () => {
    expect(css.trimStart().startsWith('@import "tailwindcss";')).toBe(true)
  })

  it("declares the dark custom variant", () => {
    expect(css).toContain("@custom-variant dark (&:is(.dark *));")
  })

  it("does not override the font stacks", () => {
    expect(css).not.toContain("--font-sans")
    expect(css).not.toContain("--font-mono")
  })

  it("maps the status tokens into the theme", () => {
    for (const name of ["success", "warning", "info"]) {
      expect(css).toContain(`--color-${name}: var(--${name});`)
      expect(css).toContain(`--color-${name}-foreground: var(--${name}-foreground);`)
    }
  })

  it("declares the destructive foreground token in both themes", () => {
    expect(css).toContain("--color-destructive-foreground: var(--destructive-foreground);")
    expect(css.match(/--destructive-foreground: oklch\(0\.985 0 0\);/g)).toHaveLength(2)
  })

  it("sets the neutral radius", () => {
    expect(css).toContain("--radius: 0.625rem;")
  })

  it("places the theme block after the tailwind import", () => {
    expect(css.indexOf('@import "tailwindcss";')).toBeLessThan(css.indexOf("@theme inline"))
  })
})
