import { defineConfig } from 'cypress';
import { getAuthStrategy } from './cypress/plugins/setup';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';

/* eslint-disable import/no-default-export*/
export default defineConfig({
  fixturesFolder: 'cypress/fixtures/perf',
  env: {
    timeout: 10000,
    threshold: 100000
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): Promise<Cypress.PluginConfigOptions> {
      config.env.cookie = false;

      on('file:preprocessor', createBundler());

      // This name is non-standard and might change based on your environment hence the separate
      // env variable.
      config.env.AUTH_PROVIDER = config.env.AUTH_PROVIDER || 'my_htpasswd_provider';
      config.env.AUTH_STRATEGY = await getAuthStrategy(config.baseUrl!);

      return config;
    },
    specPattern: '**/*.spec.ts',
    supportFile: 'cypress/support/index.ts',
    testIsolation: false
  }
});
