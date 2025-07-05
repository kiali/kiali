# Cypress Visual Testing with BDD framework

These are visual tests for kiali that are meant to be run against a live environment.

## Prerequisites

Installed all dev dependencies from frontend folder. Ensure the `baseUrl` field in the `cypress.json` file at the kiali-ui root is pointing to the server you are trying to test, alternatively you can use `CYPRESS_BASE_URL` environment variable or pass via cmd line `yarn cypress --config baseUrl=http://kiali-server:20001`. By default this is `localhost:3000` so if you are running kiali locally you should just need to do `yarn start` before running cypress.

## Running tests
The suite is able to re-install specific demo-app automatically when a faulty deployment of that demo-app is detected. The suite also install K8 Gateway API if not detected. Running the suite against custom demo-app deployments may lead to your environment being altered unexepectedly. If you want to prevent this, comment out the `Before` functions in [this file](integration/common/hooks.ts).

Before you start using Cypress suite, you might need export some environment variables - depending on environment where tests are executed.  If your authentication method defaults to `anonymous` **(i.e. dev env), no actions are needed.**

```bash
export CYPRESS_BASE_URL=<value>                      # defaults to http://localhost:3000
export CYPRESS_USERNAME=<value>                      # defaults to jenkins, opt. kubeadmin
export CYPRESS_PASSWD=<value>                        # no defaults
export CYPRESS_AUTH_PROVIDER=<value>                 # defaults to my_htpasswd_provider
export CYPRESS_ALLOW_INSECURE_KIALI_API=<true|false> # Useful when running tests locally against an insecure endpoint like crc.
export CYPRESS_STERN=<true|false>                    # defaults to false, set true for extended stern logging
```

When running the Cypress tests for multi-cluster, both contexts for the kubectl/oc command must be specified. 

```bash
export CYPRESS_CLUSTER1_CONTEXT=<value>       # context of the primary cluster with Kiali installed
export CYPRESS_CLUSTER2_CONTEXT=<value>       # context of the remote cluster 
```

Tests for single cluster setup can be run with the cypress browser:

```bash
yarn cypress
```

or in headless mode:

```bash
yarn cypress:run
```
\
In order to run the Cypress suite for a different setup (Multicluster, Tempo, etc.), add a specific suffix to your command above. The list of suffixes is available here. Only one can be used at a time. 
```bash
:multi-cluster      #for the Primary-Remote tests
:multi-primary      #for the Multi-Primary tests
:tracing            #for tests related to Tempo
```
\
Running specific test groups:

```bash
export TEST_GROUP="@smoke"
yarn cypress:run:test-group:junit
```

you can use complex expresions, like
```bash
export TEST_GROUP="not @crd-validation and not @multi-cluster and not @smoke"
yarn cypress:run:test-group:junit
```

### Running tests in a container
You can also run the test suite in a container, using the image `quay.io/kiali/kiali-cypress-tests:latest` or with a specific tag version.
System dependencies are bundled in the container but you are still required to install istio + kiali + demo apps in advance.

Use the `-e` option to set the environment variables that affect the execution of the test suite, as described in the previous sections.


To run the container:
```console
podman run -it \
  -e CYPRESS_BASE_URL=https://kiali-istio-system.apps.test-cluster.test.com \
  -e CYPRESS_PASSWD=<password> \
  -e CYPRESS_USERNAME="kubeadmin" \
  -e CYPRESS_AUTH_PROVIDER="kube:admin" \
  quay.io/kiali/kiali-cypress-tests:latest
```

By default, all tests without multicluster tests will be run (TEST_GROUP="not @multi-cluster")
If you want to run only a specific test group by tag, you can run the command above with env `TEST_GROUP`, e.g.
```console
podman run -it \
  -e CYPRESS_BASE_URL=https://kiali-istio-system.apps.test-cluster.test.com \
  -e CYPRESS_PASSWD=<password> \
  -e CYPRESS_USERNAME="kubeadmin" \
  -e CYPRESS_AUTH_PROVIDER="kube:admin" \
  -e TEST_GROUP="@smoke" \
  quay.io/kiali/kiali-cypress-tests:v1.73
```

## Structure

```
cypress.json              <- Cypress config file
cypress/    
├─ integration/           <- all tests are here
│  ├─ common/             <- step definition
│  ├─ featureFiles/       <- BDD.feature files 
├─ perf/                  <- all perf tests are here
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
2) Execute cypress - with feature file you just created
    * If you have undefined execution steps in the feature file, cypress will let you know. 
    * You only need to implement step definitions you are missing *(see 1a)* in cypress/integration/common folder 
3) Write new step definitions. 
    * The rule of the thumb is you create `.ts` file with same name as a `.feature` file like:
    * cypress/integration/featureFiles/**testcase.feature** -> cypress/integration/common/**testcase.ts**
    * Generic step definitions that can be used in multiple feature files should be grouped by **functionality** e.g. generic "table" definitions should go in the `table.ts` file but definitions specific to a single page should go in the page file.
4) Failed tests could mean that:
    * Reuse of step definitions is not suitable or gets broken by different testcase or your modifications
    * We want to refactor broken code and if its heavily used, move it into a custom command file (cypress/support/commands.ts) - i.e. `cy.login()`, `cy.kiali_apply_config()` lives there
5) Test case execution should be all green, you are ready to commit your test case. You might want verify whole regression run locally - so you did not introduce any breaking changes in your PR

## Performance Tests

These tests coarsely measure metrics such as page load time. They are meant to give a general baseline of performance but are not useful for benchmarking.  This is roughly how to use the tests:

1. Environment is setup either manually or with the perf cluster hack script.
2. Tests are run multiple times with one of the make commands.
3. Results for each run are copied manually from the output folder to a text document or spreadsheet.
4. Results are analyzed.

### Setup

These tests are environment agnostic however they do assume that you have:

1. Deployed istio and kiali
2. Run the [install testing demos script](../../hack/istio/install-testing-demos.sh)

If you'd like to test on ibmclould, there's a hack script that will setup a testing environment for you. See the "Running on IBM Cloud" section for more details.

### Run performance tests

From the kiali root:

cli
```
make -e CYPRESS_BASE_URL=http://mybaseurl perf-tests-run
```

**Note**: The performance tests are typically long running tests that perform many actions. The Cypress GUI generally does not handle this well so it's recommended to use the CLI instead.

gui
```
make perf-tests-gui
```

yarn from current dir
```
yarn cypress:perf
```
or in the headless mode:
```bash
yarn cypress:run:perf
```

### Parameterizing tests

You can adjust some inputs of the performance tests by changing the [fixture files](fixtures/perf/).

### Limiting the suite to a single test

You can easily limit your test run to a single test but unfortunately it requires a minor code change. Adding a `.only` to a `describe` or `it` statement will limit testing to that particular block. For example:

```
it.only('loads the overview page', () => {
 ...
})

it('Measures Graph load time', () => {
 ...
})
```

With the addition of the `.only`, only the "loads the overview page" test will be run.

### Results

Results are logged here: `cypress/results/performance.txt`.

### Cleanup

If the test runner fails for any reason, this can leave some resources lingering around after the tests have run. You can clean these up by running:
```
kubectl delete --ignore-not-found=true -l kiali.io=perf-testing ns
```

### Running on IBM Cloud:

You can use the [perf hack script](../../hack/perf-ibmcloud-openshift.sh) to spin up an openshift cluster on IBMCloud with Kiali + Istio + Kiali demos installed. To run the perf tests against the cluster, you must generate an IBM Cloud API Key and pass that in as the `CYPRESS_PASSWD`.

```
make -e CYPRESS_BASE_URL="https://<kiali-openshift-route>" -e CYPRESS_PASSWD="<IBMCloud API Key>" -e CYPRESS_USERNAME="IAM#<SSO-EMAIL>" -e CYPRESS_AUTH_PROVIDER="ibmcloud" perf-tests-gui
```

#### Logging into your cluster on IBM Cloud:

For `kubectl` or `oc` access to your cluster, use:

```
ibmcloud oc cluster config --cluster <cluster-name> --admin
```

#### Teardown cluster

The cluster can be cleaned up with the `ibmcloud-openshift.sh` script. You must provide the cluster name without the trailing `-cluster` e.g. if your cluster is named `my-perf-cluster` you should pass `my-perf` as the name prefix (np).

```
./hack/ibmcloud-openshift.sh -np <cluster-name-without-trailing-cluster> delete
```

## Testing Strategies


### Graph

The kiali graph is primarily a canvas element which makes it more difficult to test through query selectors with cypress. To get around this limitation, a simple way of testing visual elements is to do snapshot testing aka [visual testing](https://docs.cypress.io/guides/tooling/visual-testing). This boils down to comparing an existing image of the page to a new image. If any differences exist, the test will fail. There are other ways of testing canvas elements in Cypress but they seem to involve interacting with cypress through a custom api rather than visually which is not ideal.

## Troubleshooting

### Tests are slow and crashing frequently

Try setting the `numTestsKeptInMemory` setting to a lower value.

```
make -e CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0 cypress-run
```

For debugging locally, try setting the `video` setting to true to watch the recordings from test run.

```
make -e CYPRESS_VIDEO=true cypress-run
```

### Tests are flaking 

Try waiting for kiali to finish loading all the in-flight data before proceeding on to the next action or command. [Waiting for the loading spinner](https://github.com/kiali/kiali/blob/1766f20035e67a072dd68167869e0ce2009b9bc6/frontend/cypress/integration/common/overview.ts#L45-L46) to disappear is a good enough measure for this.

To execute only specific subset of the test suite, tag the Gherkin scenarios with the `@selected` tag. For example:
```
@selected
@bookinfo-app
Scenario: See minigraph for workload.
    Then user sees a minigraph
```
 You can then run these using:
```bash
yarn cypress:selected
```
or in the headless mode:
```bash
yarn cypress:run:selected
```
Make sure you are not tagging multi-cluster and single cluster tests together with the `@selected` tag, as both of these require different Kiali setups and it does not make sense to run them together in a single run.
