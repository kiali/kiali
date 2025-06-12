import { Before, After } from '@badeball/cypress-cucumber-preprocessor';

const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

const install_demoapp = (demoapp: string): void => {
  let namespaces = 'bookinfo';
  let deletion = `--delete-${demoapp}`;
  let tg = '-tg';
  let istio = '-in istio-system';

  if (demoapp === 'error-rates') {
    namespaces = 'alpha beta gamma';
    deletion = '--delete';
    tg = '';
  } else if (demoapp === 'sleep') {
    namespaces = 'sleep';
    tg = '';
    istio = '';
  } else if (demoapp === 'loggers') {
    namespaces = 'loggers';
    tg = '';
    istio = '';
    deletion = '--delete';
  }

  cy.exec(`../hack/istio/cypress/${demoapp}-status.sh`, { failOnNonZeroExit: false, timeout: 120000 }).then(result => {
    cy.log(result.stdout);

    if (result.code === 0) {
      cy.log(`${demoapp} demo app is up and running`);
    } else {
      cy.log(`${demoapp} demo app is either broken or not present. Installing now.`);
      cy.log(`Detecting pod architecture.`);

      cy.exec('../hack/istio/cypress/get-node-architecture.sh', { failOnNonZeroExit: false }).then(result => {
        if (result.code === 0) {
          const arch: string = result.stdout;
          cy.log(`Installing apps on ${arch} architecture.`);

          // is the suite running on openshift?
          cy.exec('kubectl api-versions | grep --quiet "route.openshift.io";', { failOnNonZeroExit: false }).then(
            result => {
              if (result.code === 0) {
                cy.log('Openshift detected.').log(`Removing old ${demoapp} installations.`);

                cy.exec(`../hack/istio/install-${demoapp}-demo.sh ${deletion} true`).then(() => {
                  cy.log('Installing new demo app.');
                  cy.exec(`../hack/istio/install-${demoapp}-demo.sh ${tg} ${istio} -a ${arch}`, {
                    timeout: 300000
                  }).then(() => {
                    cy.log('Waiting for demoapp to be ready.');

                    cy.exec(`../hack/istio/wait-for-namespace.sh -n ${namespaces}`, { timeout: 400000 });
                  });
                });
              } else {
                cy.log(`Removing old ${demoapp} installations.`)
                  .exec(`../hack/istio/install-${demoapp}-demo.sh ${deletion} true -c kubectl`)
                  .then(() => {
                    cy.log('Installing new demo app.');

                    cy.exec(`../hack/istio/install-${demoapp}-demo.sh -c kubectl ${tg} ${istio} -a ${arch}`, {
                      timeout: 300000
                    });
                  });
              }
            }
          );
        } else {
          cy.log(
            'Different architectures on various nodes detected. Failed to install the demoapp using the Cypress hook.'
          );
        }
      });
    }
  });
};

Before(() => {
  // Focing to not stop cypress on unexpected errors not related to the tests.
  // There are some random failures due timeouts/loadtime/framework that throws some error in the browser.
  // After reviewing the tests failures, those are unrelated to the app, so,
  // it needs this event to not fail the CI action due some "slow" action or similar.
  // This is something to review in future iterations when tests are solid, but I haven't found a better way to
  // solve this issue.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

Before({ tags: '@gateway-api' }, () => {
  cy.exec('kubectl get crd gateways.gateway.networking.k8s.io', { failOnNonZeroExit: false }).then(result => {
    if (result.code !== 0) {
      cy.log('Gateway API not found. Enabling it now.');

      cy.exec('kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.2.0" | kubectl apply -f -;')
        .its('code')
        .should('eq', 0);
    }
  });
});

Before({ tags: '@bookinfo-app' }, () => {
  install_demoapp('bookinfo');
});

Before({ tags: '@error-rates-app' }, () => {
  install_demoapp('error-rates');
});

Before({ tags: '@sleep-app' }, () => {
  install_demoapp('sleep');
});

Before({ tags: '@loggers-app' }, () => {
  install_demoapp('loggers');
});

Before({ tags: '@remote-istio-crds' }, () => {
  cy.exec(
    `kubectl get crd --context ${CLUSTER2_CONTEXT} -o=custom-columns=NAME:.metadata.name |  grep -E -i '.(istio|k8s).io$'`,
    { failOnNonZeroExit: false }
  ).then(result => {
    if (result.code !== 0) {
      cy.log('Istio CRDs not found on the remote cluster. Enabling it now.');

      cy.exec(
        `kubectl apply -f https://raw.githubusercontent.com/istio/istio/master/manifests/charts/base/crds/crd-all.gen.yaml --context ${CLUSTER2_CONTEXT}`
      )
        .its('code')
        .should('eq', 0)
        .then(() => {
          cy.exec(
            `kubectl rollout restart deployment/kiali -n istio-system --context ${CLUSTER1_CONTEXT} && kubectl rollout status deployment/kiali -n istio-system --context ${CLUSTER1_CONTEXT}`
          );
        });
    }
  });
});

After({ tags: '@sleep-app-scaleup-after' }, () => {
  cy.exec('kubectl scale -n sleep --replicas=1 deployment/sleep');
});

// remove resources created in the istio-system namespace to not influence istio instance after the test
After({ tags: '@clean-istio-namespace-resources-after' }, () => {
  cy.exec('kubectl -n istio-system delete PeerAuthentication default', { failOnNonZeroExit: false });
  cy.exec('kubectl -n istio-system delete Sidecar default', { failOnNonZeroExit: false });
});

const istioSharedMeshConfigMap = `
apiVersion: v1
data:
  mesh: |-
    outboundTrafficPolicy:
      mode: REGISTRY_ONLY
kind: ConfigMap
metadata:
  name: istio-user
  namespace: istio-system
`;

Before({ tags: '@shared-mesh-config' }, () => {
  cy.exec(`echo "${istioSharedMeshConfigMap}" | kubectl apply -f -`);
  const patch = '{"spec": {"values": {"pilot": {"env": {"SHARED_MESH_CONFIG": "istio-user"}}}}}';
  cy.exec(`kubectl patch istio default --type='merge' -p '${patch}'`).then(() => {
    const maxTries = 10;
    let tries = 0;
    const doRequest = (): void => {
      if (tries > maxTries) {
        throw new Error('Timed out waiting for Kiali to see the Shared Mesh Config');
      }

      tries++;
      cy.request({ method: 'GET', url: '/api/mesh/graph' }).then(response => {
        expect(response.status).to.equal(200);
        console.log(response.body.elements.nodes.find(node => node.data.infraType === 'istiod'));
        if (
          response.body.elements.nodes.find(node => node.data.infraType === 'istiod')?.data?.infraData?.config
            ?.sharedConfig === undefined
        ) {
          cy.log(`Kiali has not seen the Shared Mesh Config yet. Tries: ${tries}. Waiting 3s...`);
          cy.wait(3000);
          doRequest();
        }
      });
    };

    doRequest();
  });
});

After({ tags: '@shared-mesh-config' }, () => {
  cy.exec(`echo "${istioSharedMeshConfigMap}" | kubectl delete -f -`);
  const patch = '{"spec": {"values": {"pilot": {"env": {"SHARED_MESH_CONFIG": null}}}}}';
  cy.exec(`kubectl patch istio default --type='merge' -p '${patch}'`);
});

beforeEach(() => {
  cy.log(`Current test file: ${Cypress.spec.name}`);
  cy.exec(`touch ${Cypress.spec.name}.log`);
  // bash -c 'exec -a kubectl-logs kubectl logs -f kiali-58b649d6fd-h5n7d -n istio-system' &

  // kubectl logs kiali-6df86bf865-42nkm  -n istio-system -f --tail=1
});

// Before(function () {
//   cy.log(`Scenario name: ${this.pickle}`);
// });
