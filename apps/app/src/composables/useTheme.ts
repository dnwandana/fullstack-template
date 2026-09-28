import { computed } from "vue"
import { createSharedComposable, useColorMode } from "@vueuse/core"

export type ThemeMode = "auto" | "light" | "dark"

const MODES: readonly ThemeMode[] = ["auto", "light", "dark"]

function isThemeMode(value: string): value is ThemeMode {
  return MODES.some((mode) => mode === value)
}

/**
 * Returns the theme choice of the user. The `index.html` script reads the same
 * `ui.theme` key before the first paint, so keep the two in step.
 */
export const useTheme = createSharedComposable(() => {
  const colorMode = useColorMode({ storageKey: "ui.theme", initialValue: "auto" })

  // An old or hand-edited value must not become a class on <html>.
  if (!isThemeMode(colorMode.store.value)) colorMode.store.value = "auto"

  const mode = computed<ThemeMode>({
    get: () => (isThemeMode(colorMode.store.value) ? colorMode.store.value : "auto"),
    set: (value) => {
      colorMode.store.value = value
    },
  })

  return { mode }
})
