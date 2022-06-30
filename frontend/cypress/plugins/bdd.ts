const browserify = require('@cypress/browserify-preprocessor');
const cucumber = require('cypress-cucumber-preprocessor').default;
const path = require('path');
const plugin = require('./index');

module.exports = (on, config) => {
  config = plugin(on, config);
  const options = {
    ...browserify.defaultOptions,
    typescript: path.join(path.resolve('..'), 'frontend/node_modules/typescript')
  };

  on('file:preprocessor', cucumber(options));

  return config;
};
