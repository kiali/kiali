import { Before } from '@badeball/cypress-cucumber-preprocessor';

Before({tags: '@gateway-api'}, async function () {
  cy.exec('kubectl get crd gateways.gateway.networking.k8s.io',{failOnNonZeroExit: false}).then((result) => {
    if (result.code != 0){
      cy.log("Gateway API not found. Enabling it now.");
      cy.exec('kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v0.5.1" | kubectl apply -f -;')
      .its('code').should('eq', 0);
    }
  })
});
