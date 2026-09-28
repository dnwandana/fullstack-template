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

  it("maps the status tokens into the theme", () => {
    for (const name of ["success", "warning", "info"]) {
      expect(css).toContain(`--color-${name}: var(--${name});`)
      expect(css).toContain(`--color-${name}-foreground: var(--${name}-foreground);`)
    }
  })

  it("places the theme block after the tailwind import", () => {
    expect(css.indexOf('@import "tailwindcss";')).toBeLessThan(css.indexOf("@theme inline"))
  })

  it("self-hosts Geist and puts the variable fonts first", () => {
    expect(css).toContain('@import "@fontsource-variable/geist";')
    expect(css).toContain('@import "@fontsource-variable/geist-mono";')
    expect(css).toMatch(/--font-sans:\s+"Geist Variable", "Geist", ui-sans-serif/)
    expect(css).toMatch(/--font-mono:\s+"Geist Mono Variable", "Geist Mono", ui-monospace/)
    expect(css).not.toContain("fonts.googleapis.com")
  })

  it("maps the link and overlay tokens into the theme", () => {
    expect(css).toContain("--color-link: var(--link);")
    expect(css).toContain("--color-overlay: var(--overlay);")
    expect(css).toContain("--overlay: oklch(0.208 0.042 265.755 / 0.4);")
    expect(css).toContain("--overlay: oklch(0.09 0.01 265 / 0.7);")
  })

  it("fills the dark block with its own surfaces", () => {
    const dark = css.slice(css.indexOf(".dark {"))
    expect(dark).toContain("--sidebar: oklch(0.13 0.011 265);")
    expect(dark).toContain("--background: oklch(0.155 0.012 265);")
    expect(dark).toContain("--card: oklch(0.185 0.013 265);")
    expect(dark).toContain("--popover: oklch(0.21 0.014 265);")
  })

  it("routes the shadow utilities through the elevation tokens", () => {
    expect(css).toContain("--shadow-md: var(--elevation-md);")
    expect(css).toContain("--shadow-lg: var(--elevation-lg);")
  })

  it("declares the destructive foreground token in both themes", () => {
    expect(css).toContain("--color-destructive-foreground: var(--destructive-foreground);")
    expect(css.match(/--destructive-foreground: oklch\(0\.985 0\.002 265\);/g)).toHaveLength(2)
  })

  it("sets the mockup radius", () => {
    expect(css).toContain("--radius: 0.5rem;")
  })
})
