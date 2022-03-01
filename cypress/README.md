# Cypress Integration Tests

These are end to end tests for kiali that are meant to be run against a live environment.

## Prerequisites

Ensure the `baseUrl` field in the `cypress.json` file at the kiali-ui root is pointing to the server you are trying to test. By default this is `localhost:3000` so if you are running kiali locally you should just need to do `yarn start` before running cypress.

## Running tests

Tests can be run with the cypress browser:

```bash
yarn cypress
```

or in headless mode:

```bash
yarn cypress:run
```

## Testing Strategies

### Graph

The kiali graph is primarily a canvas element which makes it more difficult to test through query selectors with cypress. To get around this limitation, a simple way of testing visual elements is to do snapshot testing aka [visual testing](https://docs.cypress.io/guides/tooling/visual-testing). This boils down to comparing an existing image of the page to a new image. If any differences exist, the test will fail. There are other ways of testing canvas elements in Cypress but they seem to involve interacting with cypress through a custom api rather than visually which is not ideal.
