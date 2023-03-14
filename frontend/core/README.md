# Kiali Core

[![Kiali Core badge](https://img.shields.io/npm/v/@kiali/core.svg?label=PF4%20Core&style=for-the-badge)](https://www.npmjs.com/package/@kiali/core) [![Coverage Status](https://coveralls.io/repos/github/kiali/kiali/badge.svg?branch=master)](https://coveralls.io/github/kiali/kiali?branch=master)

## Development setup

### Setup for Kiali-UI

There is a [setupDevPlugin](../setupDevPlugin.sh) script to enable/disable the core library with the console.

    -ep|--enable-library
      The option to perform the setup of core library.
      If you set this to disable the script will remove all the links.
      If you want the script to set up the core library for you, normally keep the default value.
      Default: ${DEFAULT_ENABLE_LIBRARY}

This script is performing the next steps for you

```bash
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
```

Console need this configuration to use the library locally

## Guidelines

# Semantic Commit Messages

We should set commit message with this format:

Format: `<type>(<scope>): <subject>`

`<scope>` is optional

## Example

```
feat: add hat wobble
^--^  ^------------^
|     |
|     +-> Summary in present tense.
|
+-------> Type: chore, docs, feat, fix, refactor, style, or test.
```

More Examples:

- `major`: A new version with breaking changes
- `feat`: (new feature for the user, not a new feature for build script)
- `fix`: (bug fix for the user, not a fix to a build script)
- `docs`: (changes to the documentation)
- `style`: (formatting, missing semi colons, etc; no production code change)
- `refactor`: (refactoring production code, eg. renaming a variable)
- `test`: (adding missing tests, refactoring tests; no production code change)