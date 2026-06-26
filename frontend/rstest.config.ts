import { defineConfig } from '@rstest/core';
import { withRsbuildConfig } from '@rstest/adapter-rsbuild';
import path from 'path';

export default defineConfig({
  extends: withRsbuildConfig(),
  globals: true,
  include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  resolve: {
    alias: {
      'react-dom/client': path.resolve(__dirname, 'src/test-shims/react-dom-client.cjs')
    }
  },
  setupFiles: ['./src/setupTests.ts'],
  testEnvironment: 'jsdom'
});
