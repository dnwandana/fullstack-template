import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/global-setup.js"],
    include: ["tests/**/*.test.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
