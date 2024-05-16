/// <reference types="vitest" />
import { defineConfig } from 'vite'

const TEST_TIMEOUT = 10 * 1000

export default defineConfig({
  test : {
    testTimeout: TEST_TIMEOUT
  },
})