import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

const { publicVars } = loadEnv({ prefixes: ['REACT_APP_'] });

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [pluginReact(), pluginSass(), pluginSvgr({ mixedImport: true })],
  html: {
    template: './public/index.html'
  },
  output: {
    assetPrefix: './',
    distPath: { root: 'build' },
    sourceMap: { css: false, js: false }
  },
  source: {
    define: {
      ...publicVars,
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
  server: {
    historyApiFallback: true,
    open: true,
    port: 3000,
    proxy: {
      '/api': {
        changeOrigin: true,
        target: process.env.KIALI_PROXY_URL || 'http://localhost:20001'
      },
      '/kiali': {
        changeOrigin: true,
        target: process.env.KIALI_PROXY_URL || 'http://localhost:20001'
      }
    }
  }
});
