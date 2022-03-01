const browserify = require('@cypress/browserify-preprocessor');
const cucumber = require('cypress-cucumber-preprocessor').default;
const path = require('path');

module.exports = (on, config) => {
  const options = {
    ...browserify.defaultOptions,
    typescript: path.join(path.resolve('..'), 'kiali-ui/node_modules/typescript'),
  };

  on('file:preprocessor', cucumber(options));
};
