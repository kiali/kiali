import { defineConfig } from 'cypress';
import { getAuthStrategy } from './cypress/plugins/setup';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';

export default defineConfig({
  fixturesFolder: 'cypress/fixtures/perf',
  env: {
    cookie: false,
    rootSelector: '#root',
    threshold: 100000,
    timeout: 10000
  },
  e2e: {
    baseUrl: 'http://localhost:3001',
    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): Promise<Cypress.PluginConfigOptions> {
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
