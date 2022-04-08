# Cypress Visual Testing with BDD framework

These are visual tests for kiali that are meant to be run against a live environment.

## Prerequisites

Installed all dev dependencies from frontend folder. Ensure the `baseUrl` field in the `cypress.json` file at the kiali-ui root is pointing to the server you are trying to test, alternatively you can use `CYPRESS_BASE_URL` environment variable or pass via cmd line `yarn cypress --config baseUrl=http://kiali-server:20001`. By default this is `localhost:3000` so if you are running kiali locally you should just need to do `yarn start` before running cypress.

## Running tests

Before you start using Cypress suite, you might need export some environment variables - depending on environment where tests are executed. If your authentication method defaults to `anonymous` **(i.e. dev env), no actions are needed.**

```bash
export CYPRESS_BASE_URL=<value>        # defaults to http://localhost:3000
export CYPRESS_USERNAME=<value>        # defaults to jenkins, opt. kubeadmin
export CYPRESS_PASSWD=<value>          # no defaults 
export CYPRESS_AUTH_PROVIDER=<value>   # defaults to my_htpasswd_provider, 
                                       # or optionally openshift for AWS
```

Tests can be run with the cypress browser:

```bash
yarn cypress
```

or in headless mode:

```bash
yarn cypress:run
```

## Structure

```
cypress.json              <- Cypress config file
cypress/    
├─ integration/           <- all tests are here
│  ├─ common/             <- step definition
│  ├─ featureFiles/       <- BDD.feature files 
├─ support/
│  ├─ commands.ts         <- custom cy.commands()
├─ screenshots/           <- pictures from test run
├─ videos/                <- recordings from test run
```

## Workflow

1) Create a .feature file (i.e. `testcase.feature`) in cypress/integration/featureFiles folder *(you don’t need to create one if it is already part of the ticket/user story - this is deliverable for each feature/user story)*
    * One feature file should contain only one **specific** feature or concrete example of tested **feature / story**
    * Try to reuse already existing steps, like: `Given user is at administrator perspective` or `And I see {string} in the title` from other .feature files. The BDD framework doesn't mind interchanging keywords, like `Then I see {string} in the title`
    * If you are covering more complex flow (smoke, happy path, critical path) composed of multiple feature files, you need to decorate them with the `@` symbol (`@smoke`, `@happypath`, `@etc`)
1) Execute cypress - with feature file you just created
    * If you have undefined execution steps in the feature file, cypress will let you know. 
    * You only need to implement step definitions you are missing *(see 1a)* in cypress/integration/common folder 
1) Write new step definitions. 
    * The rule of the thumb is you create `.ts` file with same name as a `.feature` file like:
    * cypress/integration/featureFiles/**testcase.feature** -> cypress/integration/common/**testcase.ts**
1) Failed tests could mean that:
    * Reuse of step definitions is not suitable or gets broken by different testcase or your modifications
    * We want to refactor broken code and if its heavily used, move it into a custom command file (cypress/support/commands.ts) - i.e. `cy.login()`, `cy.kiali_apply_config()` lives there
1) Test case execution should be all green, you are ready to commit your test case. You might want verify whole regression run locally - so you did not introduce any braking changes in your PR


## Testing Strategies



### Graph

The kiali graph is primarily a canvas element which makes it more difficult to test through query selectors with cypress. To get around this limitation, a simple way of testing visual elements is to do snapshot testing aka [visual testing](https://docs.cypress.io/guides/tooling/visual-testing). This boils down to comparing an existing image of the page to a new image. If any differences exist, the test will fail. There are other ways of testing canvas elements in Cypress but they seem to involve interacting with cypress through a custom api rather than visually which is not ideal.

## Troubleshooting

### Tests are slow and crashing frequently

Try setting the `numTestsKeptInMemory` setting to a lower value.

```
make -e CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0 cypress
```