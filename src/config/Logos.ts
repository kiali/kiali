// All logo images go in here

/** Istio logo */
export const IstioLogo = require('../assets/img/istio-logo.svg');

/** Kiali logo */
export const KialiLogo = require('../assets/img/logo-alt.svg');

// Runtimes
export const runtimesLogoProviders = {
  'Vert.x': () => require('../assets/img/vertx-logo.png'),
  'Node.js': () => require('../assets/img/nodejs-logo.png'),
  Thorntail: () => require('../assets/img/thorntail-logo.png')
};
