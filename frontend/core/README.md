# Kiali Core


[![Kiali Core badge](https://img.shields.io/npm/v/@kiali/core.svg?label=PF4%20Core&style=for-the-badge)](https://www.npmjs.com/package/@kiali/core)

## coverage

![Coverage lines](./badges/badge-lines.svg)
![Coverage functions](./badges/badge-functions.svg)
![Coverage branches](./badges/badge-branches.svg)
![Coverage statements](./badges/badge-statements.svg)


## Development setup

cd YOUR_PROJECT
cd node_modules/react
yarn link
cd ../react-dom
yarn link

cd PACKAGE_YOU_DEBUG_LOCALLY
yarn link
yarn install
yarn link react
yarn link react-dom

cd YOUR_PROJECT
yarn link PACKAGE_YOU_DEBUG_LOCALLY


Each time that we want to propagate the changes to kiali-Ui we need to make the build `npm run build`