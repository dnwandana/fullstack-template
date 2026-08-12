/**
 * @vitest-environment node
 *
 * Forced to the node environment: under jsdom (this project's default),
 * Vite's client-consumer transform rewrites the `new URL(relative,
 * import.meta.url)` pattern below into a dev-server asset URL instead of
 * resolving it at runtime, so fileURLToPath() receives a non-file:// URL.
 * The node environment uses Vite's SSR pipeline, which leaves it untouched.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { antdTheme } from "../antd"

const colorsCss = readFileSync(
  fileURLToPath(new URL("../../assets/design-system/tokens/colors.css", import.meta.url)),
  "utf-8",
)

/** Read a hex value out of the copied design-system stylesheet. */
function cssVar(name: string): string {
  const match = colorsCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))
  if (!match) throw new Error(`--${name} not found in colors.css`)
  return match[1].toLowerCase()
}

/**
 * Look a token up by name. `Object.entries` yields a `string` key, which the antd token types
 * reject — walking the entries reads the same value without an index signature or a cast.
 * `String(undefined)` is `"undefined"`, so a missing token fails the assertion with the token
 * name in the message rather than throwing a TypeError.
 */
function rawToken(source: object | undefined, name: string): string {
  const entry = Object.entries(source ?? {}).find(([key]) => key === name)
  return String(entry?.[1])
}

/** `rawToken`, lowercased for comparison against `cssVar`'s normalised hex. */
function tokenValue(source: object | undefined, name: string): string {
  return rawToken(source, name).toLowerCase()
}

function componentTokens(name: string): object | undefined {
  return Object.entries(antdTheme.components ?? {}).find(([key]) => key === name)?.[1]
}

const SEED_MAP = {
  colorPrimary: "teal-500",
  colorSuccess: "green-500",
  colorWarning: "amber-500",
  colorError: "red-500",
  colorInfo: "blue-500",
  colorTextBase: "gray-900",
  colorBgBase: "gray-0",
  colorBgLayout: "gray-25",
  colorBorder: "gray-200",
  colorBorderSecondary: "gray-150",
  colorTextSecondary: "gray-600",
  colorTextTertiary: "gray-500",
  colorTextQuaternary: "gray-400",
}

const COMPONENT_MAP = {
  "Layout.colorBgHeader": "gray-0",
  "Layout.colorBgBody": "gray-25",
  "Layout.colorBgTrigger": "gray-100",
  "Menu.colorItemBg": "gray-0",
  "Menu.colorItemText": "gray-600",
  "Menu.colorItemBgSelected": "teal-50",
  "Menu.colorItemTextSelected": "teal-700",
}

describe("antdTheme", () => {
  it.each(Object.entries(SEED_MAP))("seed %s matches --%s", (tokenName, varName) => {
    expect(tokenValue(antdTheme.token, tokenName)).toBe(cssVar(varName))
  })

  it.each(Object.entries(COMPONENT_MAP))("component %s matches --%s", (path, varName) => {
    const [component, tokenName] = path.split(".")
    expect(tokenValue(componentTokens(component), tokenName)).toBe(cssVar(varName))
  })

  // Ant's own defaults already equal the design system's values. Declaring them
  // is not merely redundant — the superseded spec set borderRadius: 4, which
  // moved the app AWAY from the artboards. Pin the omission.
  it.each([
    "fontSize",
    "borderRadius",
    "borderRadiusLG",
    "borderRadiusSM",
    "controlHeight",
    "controlHeightSM",
    "controlHeightLG",
    "lineWidth",
  ])("does not override %s", (tokenName) => {
    expect(antdTheme.token).not.toHaveProperty(tokenName)
  })

  it("uses the IBM Plex families", () => {
    // Read through `rawToken` rather than a property access: `token` is optional on
    // ThemeConfig, and `fontFamilyCode` is not declared on 4.2.6's AliasToken at all
    // (see the TODO in theme/antd.ts). Casing matters here, so no lowercasing.
    expect(rawToken(antdTheme.token, "fontFamily")).toContain("IBM Plex Sans")
    expect(rawToken(antdTheme.token, "fontFamilyCode")).toContain("IBM Plex Mono")
  })
})
