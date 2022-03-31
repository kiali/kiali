const browserify = require('@cypress/browserify-preprocessor');
const cucumber = require('cypress-cucumber-preprocessor').default;
const path = require('path');
const axios = require('axios');


module.exports = (on, config) => {
  config.env.cookie = false
  const options = {
    ...browserify.defaultOptions,
    typescript: path.join(path.resolve('..'), 'kiali-ui/node_modules/typescript'),
  };

  on('file:preprocessor', cucumber(options));

  async function exportConfig() {
    const getAuthStrategy = async (url: string) => {
      try {
        const resp = await axios.get(url+'/api/auth/info')
        return resp.data.strategy
      } catch (err) {
        console.error(`ERROR: Kiali API is not reachable at ${JSON.stringify(err.config.url)}`);
        throw new Error(`Kiali API is not reachable at ${JSON.stringify(err.config.url)}`)
      }
    }

    config.env.auth_strategy = await getAuthStrategy(config.baseUrl)
    return await config
  }

  return exportConfig()
};


