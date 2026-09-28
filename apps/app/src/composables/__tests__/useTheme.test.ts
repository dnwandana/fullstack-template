import { effectScope, nextTick, type EffectScope } from "vue"
import { useTheme } from "@/composables/useTheme"

let scope: EffectScope

function run() {
  scope = effectScope()
  return scope.run(() => useTheme())!
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ""
})
// Stopping the scope disposes the shared instance, so each test starts fresh.
afterEach(() => scope.stop())

describe("useTheme", () => {
  it("defaults to auto and follows a light system", async () => {
    const { mode } = run()
    await nextTick()
    expect(mode.value).toBe("auto")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("stores dark under ui.theme and sets the dark class", async () => {
    const { mode } = run()
    mode.value = "dark"
    await nextTick()
    expect(localStorage.getItem("ui.theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("removes the dark class for light", async () => {
    const { mode } = run()
    mode.value = "dark"
    await nextTick()
    mode.value = "light"
    await nextTick()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("falls back to auto when the stored value is not a known mode", async () => {
    localStorage.setItem("ui.theme", "purple")
    const { mode } = run()
    await nextTick()
    expect(mode.value).toBe("auto")
    expect(localStorage.getItem("ui.theme")).toBe("auto")
    expect(document.documentElement.classList.contains("purple")).toBe(false)
  })
})
