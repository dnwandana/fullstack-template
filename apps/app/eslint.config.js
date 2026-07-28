import { globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import {
  configureVueProject,
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import pluginOxlint from 'eslint-plugin-oxlint'

// `vueTsConfigs.recommended` turns on `vue/block-lang`, which demands `lang="ts"` on every
// `<script>` block. Every SFC under `src/` is TypeScript now, so `ts` is the only accepted
// lang — this is the lint-side twin of `allowJs` being absent from `tsconfig.app.json`.
// Re-adding `"js"` here would let a `<script setup>` with no `lang="ts"` back in unflagged.
configureVueProject({ scriptLangs: ['ts'] })

export default defineConfigWithVueTs([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    name: 'app/test-files',
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  skipFormatting,

  ...pluginOxlint.configs['flat/recommended'],
])
