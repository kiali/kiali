import { Before, After } from '@badeball/cypress-cucumber-preprocessor';

function install_demoapp(demoapp: string) {
  var namespaces: string = 'bookinfo';
  var deletion: string = `--delete-${demoapp}`;
  var tg: string = '-tg';
  var istio: string = '-in istio-system';

  if (demoapp == 'error-rates') {
    namespaces = 'alpha beta gamma';
    deletion = '--delete';
    tg = '';
  } else if (demoapp == 'sleep') {
    namespaces = 'sleep';
    tg = '';
    istio = '';
  }

  cy.exec(`../hack/istio/cypress/${demoapp}-status.sh`, { failOnNonZeroExit: false, timeout: 120000 }).then(result => {
    cy.log(result.stdout);
    if (result.code == 0) {
      cy.log(`${demoapp} demo app is up and running`);
    } else {
      cy.log(`${demoapp} demo app is either broken or not present. Installing now.`);
      cy.log(`Detecting pod architecture.`);
      cy.exec('../hack/istio/cypress/get-node-architecture.sh', { failOnNonZeroExit: false }).then(result => {
        if (result.code == 0) {
          const arch: string = result.stdout;
          cy.log(`Installing apps on ${arch} architecture.`);
          // is the suite running on openshift?
          cy.exec('kubectl api-versions | grep --quiet "route.openshift.io";', { failOnNonZeroExit: false }).then(
            result => {
              if (result.code == 0) {
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
}

Before({ tags: '@gateway-api' }, function () {
  cy.exec('kubectl get crd gateways.gateway.networking.k8s.io', { failOnNonZeroExit: false }).then(result => {
    if (result.code != 0) {
      cy.log('Gateway API not found. Enabling it now.');
      cy.exec('kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v0.5.1" | kubectl apply -f -;')
        .its('code')
        .should('eq', 0);
    }
  });
});

Before({ tags: '@bookinfo-app' }, function () {
  install_demoapp('bookinfo');
});

Before({ tags: '@error-rates-app' }, function () {
  install_demoapp('error-rates');
});

Before({ tags: '@sleep-app' }, function () {
  install_demoapp('sleep');
});

After({ tags: '@sleep-app-scaleup-after' }, function () {
  cy.exec('kubectl scale -n sleep --replicas=1 deployment/sleep');
});
