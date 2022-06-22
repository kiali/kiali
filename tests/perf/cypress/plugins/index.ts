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

const webpackPreprocessor = require('../../../../frontend/node_modules/@cypress/webpack-batteries-included-preprocessor')
const path = require('path');
/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on) => {
  on('file:preprocessor', webpackPreprocessor({
    typescript: path.join(path.resolve('../../', 'frontend/node_modules/typescript')),
  }))
}
