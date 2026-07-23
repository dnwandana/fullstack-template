/**
 * Ant Design Vue theme configuration.
 *
 * Maps the claude-design token system onto ConfigProvider. Every value is
 * annotated with the design-system custom property it mirrors; antd.test.js
 * asserts the two still agree.
 *
 * Component token names follow an OLDER antd v5 schema than the current React
 * docs describe, and unknown keys are dropped silently. Every name below was
 * read from node_modules/ant-design-vue/es/<component>/style/index.d.ts.
 * Verify any addition the same way.
 */

export const antdTheme = {
  token: {
    colorPrimary: "#0e7c72", // --teal-500
    colorSuccess: "#2f855a", // --green-500
    colorWarning: "#b5791d", // --amber-500
    colorError: "#c14444", // --red-500
    colorInfo: "#2f6bb0", // --blue-500

    colorTextBase: "#171b20", // --gray-900
    colorBgBase: "#ffffff", // --gray-0
    colorBgLayout: "#fafbfc", // --gray-25

    colorBorder: "#d6dbe0", // --gray-200
    colorBorderSecondary: "#e3e7eb", // --gray-150

    colorTextSecondary: "#565f69", // --gray-600
    colorTextTertiary: "#6d7680", // --gray-500
    colorTextQuaternary: "#98a1ab", // --gray-400

    fontFamily: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", ui-monospace, monospace',

    wireframe: false,

    // Deliberately NOT declared — antd's defaults already match the design
    // system: fontSize 14, borderRadius 6 (deriving LG 8 / SM 4 / XS 2),
    // controlHeight 32 (deriving SM 24 / LG 40), lineWidth 1.
  },

  components: {
    Layout: {
      colorBgHeader: "#ffffff", // --gray-0
      colorBgBody: "#fafbfc", // --gray-25
      colorBgTrigger: "#eceff2", // --gray-100
    },
    Menu: {
      colorItemBg: "#ffffff", // --gray-0
      colorItemText: "#565f69", // --gray-600
      colorItemBgSelected: "#eef7f5", // --teal-50
      colorItemTextSelected: "#084f49", // --teal-700
      radiusItem: 7, // artboard 04
      // Suppress antd's active bar, which inline Menu draws on the RIGHT edge.
      // SideNav.vue draws the artboard's 3px LEFT bar in scoped CSS.
      colorActiveBarBorderSize: 0,
    },
  },
}

export default antdTheme
