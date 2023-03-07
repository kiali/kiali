import { defineConfig } from 'cypress';
import { getAuthStrategy } from './cypress/plugins/setup';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import browserify from '@badeball/cypress-cucumber-preprocessor/browserify';

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
    }
  },
  e2e: {
    baseUrl: 'http://localhost:3000',
    async setupNodeEvents(on, config) {
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config);

      on(
        'file:preprocessor',
        browserify(config, {
          typescript: require.resolve('typescript')
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
