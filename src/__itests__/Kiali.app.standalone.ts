/**
 * Launch Kiali UI locally serving the static files from the `build` dir.  API calls are
 * proxy'ed to public Kiali instance.
 * Example,
 * # npm run kiali
 */
const express = require('express');
const proxy = require('http-proxy-middleware');

const app = express();

const PORT = 5003;

app.use(
  '/api',
  proxy({
    target: 'http://kiali-istio-system.45.56.100.74.nip.io',
    changeOrigin: true
  })
);

app.use('/console/**', express.static(__dirname + '/../../build/', { fallthrough: true }));

app.use(express.static(__dirname + '/../../build', { fallthrough: true }));

app.listen(PORT, () => console.log('Kiali is ready at http://localhost:' + PORT));
