import { defineConfig } from 'cypress';
import { getAuthStrategy } from './cypress/plugins/setup';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';

/* eslint-disable import/no-default-export*/
export default defineConfig({
  viewportWidth: 1920,
  viewportHeight: 1080,
  defaultCommandTimeout: 40000,
  animationDistanceThreshold: 20,
  execTimeout: 150000,
  pageLoadTimeout: 90000,
  requestTimeout: 15000,
  responseTimeout: 15000,
  fixturesFolder: 'cypress/fixtures',
  env: {
    'cypress-react-selector': {
      root: '#root'
    },
    omitFiltered: true,
    filterSpecs: true
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): Promise<Cypress.PluginConfigOptions> {
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config);

      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)]
        })
      );

      config.env.cookie = false;

      // This name is non-standard and might change based on your environment hence the separate
      // env variable.
      config.env.AUTH_PROVIDER = config.env.AUTH_PROVIDER || 'my_htpasswd_provider';
      config.env.AUTH_STRATEGY = await getAuthStrategy(config.baseUrl!);

      return config;
    },
    specPattern: '**/*.feature',
    supportFile: 'cypress/support/index.ts'
  }
});
