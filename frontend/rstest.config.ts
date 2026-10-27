import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';

export default defineConfig({
  extends: withRsbuildConfig(),
  globals: true,
  include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  setupFiles: ['./src/setupTests.ts'],
  testEnvironment: 'jsdom'
});
