/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)
const axios = require('axios');

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  config.env.cookie = false;
  // This name is non-standard and might change based on your environment hence the separate
  // env variable.
  config.env.AUTH_HTTP_PROVIDER_NAME = config.env.AUTH_HTTP_PROVIDER_NAME || 'my_htpasswd_provider';
  config.env.AUTH_PROVIDER = config.env.AUTH_PROVIDER || 'my_htpasswd_provider';

  async function exportConfig() {
    const getAuthStrategy = async (url: string) => {
      try {
        const resp = await axios.get(url + '/api/auth/info');
        return resp.data.strategy;
      } catch (err) {
        console.error(`ERROR: Kiali API is not reachable at ${JSON.stringify(err.config.url)}`);
        throw new Error(`Kiali API is not reachable at ${JSON.stringify(err.config.url)}`);
      }
    };

    config.env.AUTH_STRATEGY = await getAuthStrategy(config.baseUrl);
    return await config;
  }

  return exportConfig();
};
