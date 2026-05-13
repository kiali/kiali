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
  retries: {
    runMode: 2,
    openMode: 0
  },
  animationDistanceThreshold: 20,
  execTimeout: 150000,
  pageLoadTimeout: 90000,
  requestTimeout: 15000,
  responseTimeout: 15000,
  fixturesFolder: 'cypress/fixtures',
  expose: {
    cookie: false,
    filterSpecs: true,
    omitFiltered: true,
    rootSelector: '#root'
  },
  env: {
    // ALLOW_INSECURE_KIALI_API: true,
    // PASSWD: 'kiali',
    // USERNAME: 'kiali'
  },
  e2e: {
    baseUrl: 'http://localhost:3001',
    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ): Promise<Cypress.PluginConfigOptions> {
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config);

      on('task', {
        log(message: string) {
          console.log(message);
          return null;
        }
      });

      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)]
        })
      );

      // When targeting an HTTPS endpoint with self-signed certificates
      // (e.g. CRC), the browser itself must also bypass cert validation
      // — ALLOW_INSECURE_KIALI_API only covers Node.js cy.request() calls.
      if (config.env.ALLOW_INSECURE_KIALI_API) {
        on('before:browser:launch', (browser, launchOptions) => {
          if (browser.family === 'chromium') {
            launchOptions.args.push('--ignore-certificate-errors');
          }
          if (browser.family === 'firefox') {
            launchOptions.preferences['security.enterprise_roots.enabled'] = true;
          }
          return launchOptions;
        });
      }

      // Auth strategy is discovered at config time and is safe to expose.
      config.expose = config.expose ?? {};
      config.expose.AUTH_STRATEGY = await getAuthStrategy(config.baseUrl!, config.env.ALLOW_INSECURE_KIALI_API);

      return config;
    },
    specPattern: '**/*.feature',
    supportFile: 'cypress/support/index.ts',
    testIsolation: false
  }
});
