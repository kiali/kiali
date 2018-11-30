# CI tools

This directory contains some tools that are required for CI. Currently, these tools are:

* [semver](https://github.com/fsaintjacques/semver-tool) v2.1.0. This is a command
  line script to manipulate version strings. Used in CI as a helper to bump version
  variables.
* [jq](https://stedolan.github.io/jq/) v1.6. This is a (binary) tool to process JSON
  files. It's used in CI to read and update the version string in the package.json
  file of the UI, when needed.
