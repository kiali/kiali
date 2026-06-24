import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

const { publicVars } = loadEnv({ prefixes: ['REACT_APP_'] });

// Catch-all so any unmatched process.env.X resolves to undefined instead of crashing.
// Skipped during test runs because Rstest's runtime needs real process.env access.
const isTestRunner = Boolean(process.env.RSTEST || process.env.TEST_RUNNER);
const processEnvFallback = isTestRunner ? {} : { 'process.env': JSON.stringify({}) };

// Preserve React component names so Cypress cy.getReact() can find them via the fiber tree.
const keepNames = {
  jsOptions: {
    minimizerOptions: {
      compress: { keep_classnames: true, keep_fnames: true },
      mangle: { keep_classnames: true, keep_fnames: true }
    }
  }
};

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [pluginReact(), pluginSass(), pluginSvgr({ mixedImport: true })],
  html: {
    template: './public/index.html'
  },
  output: {
    assetPrefix: './',
    distPath: { root: 'build' },
    minify: keepNames,
    sourceMap: { css: false, js: false }
  },
  source: {
    define: {
      ...publicVars,
      ...processEnvFallback,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.PUBLIC_URL': JSON.stringify(''),
      'process.env.API_PROXY': JSON.stringify(process.env.API_PROXY || ''),
      'process.env.CSS_PREFIX': JSON.stringify(process.env.CSS_PREFIX || 'kiali'),
      'process.env.I18N_NAMESPACE': JSON.stringify(process.env.I18N_NAMESPACE || ''),
      'process.env.RSTEST': false,
      'process.env.TEST_RUNNER': JSON.stringify(process.env.TEST_RUNNER || '')
    },
    tsconfigPath: './tsconfig.json'
  },
  tools: {
    cssExtract: {
      loaderOptions: {
        publicPath: '../../'
      }
    }
  },
  server: {
    historyApiFallback: true,
    open: true,
    port: Number(process.env.PORT) || 3001,
    proxy: {
      '/api': {
        changeOrigin: true,
        target: process.env.KIALI_PROXY_URL || 'http://localhost:20001/kiali'
      }
    }
  }
});
