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

Before({tags: '@bookinfo-app'}, async function () {
  cy.exec('../hack/istio/cypress/bookinfo-status.sh',{failOnNonZeroExit: false}).then((result) => {
    cy.log(result.stdout);
    if (result.code == 0){
      cy.log("Bookinfo demo app is up and running.");
    } 
    else{
      cy.log("Bookinfo demo app is either broken or not present. Installing now.").log("Removing old bookinfo installations.");
      cy.exec('../hack/istio/cypress/get-node-architecture.sh',{failOnNonZeroExit: false}).then((result)=>{
        cy.log(`Exit code: ${result.code}`);
        if(result.code == 0){
          const arch:string = result.stdout;
          cy.log(`Installing apps on ${arch} architecture.`);
          // is the suite running on openshift?
          cy.exec('kubectl api-versions | grep --quiet "route.openshift.io";', {failOnNonZeroExit:false}).then((result) =>{
            if (result.code == 0){
              cy.exec('../hack/istio/install-bookinfo-demo.sh --delete-bookinfo true').then(()=>{
                cy.exec(`../hack/istio/install-bookinfo-demo.sh -tg -in istio-system -a ${arch}`).then(() =>{
                  cy.exec('../hack/istio/cypress/wait-for-bookinfo.sh');
                })
              })
            }
            else{
              cy.exec('../hack/istio/install-bookinfo-demo.sh --delete-bookinfo true -c kubectl').then(()=>{
                cy.exec(`../hack/istio/install-bookinfo-demo.sh -c kubectl -tg -in istio-system -a ${arch}`);
              })
            }
          })
        }
        else {
          cy.log("Different architectures on various nodes detected. Failed to install the demoapp using the Cypress hook.");
        }
      })
    }
  })
});

Before({tags: '@error-rates-app'}, async function () {
  cy.exec('../hack/istio/cypress/error-rates-status.sh',{failOnNonZeroExit: false}).then((result) => {
    cy.log(result.stdout);
    if (result.code == 0){
      cy.log("Error Rates demo app is up and running.");
    } 
    else{
      cy.log("Error Rates demo app is either broken or not present. Installing now.").log("Removing old Error Rates installations.");
      cy.exec('../hack/istio/cypress/get-node-architecture.sh',{failOnNonZeroExit: false}).then((result)=>{
        cy.log(`Exit code: ${result.code}`);
        if (result.code == 0){
          const arch:string = result.stdout;
          cy.log(`Installing apps on ${arch} architecture.`);
          // is the suite running on openshift?
          cy.exec('kubectl api-versions | grep --quiet "route.openshift.io";', {failOnNonZeroExit:false}).then((result) =>{
            if (result.code == 0){
              cy.exec('../hack/istio/install-error-rates-demo.sh --delete true').then(()=>{
                cy.exec('../hack/istio/install-error-rates-demo.sh -in istio-system -a amd64').then(()=> {
                  cy.exec('oc wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator; sleep 80;');
                });
              })
            }
            else{
              cy.exec('../hack/istio/install-error-rates-demo.sh --delete true -c kubectl').then(()=>{
                cy.exec('../hack/istio/install-error-rates-demo.sh -c kubectl -in istio-system -a amd64');
              })
            }
          })
        }
        else{
          cy.log("Different architectures on various nodes detected. Failed to install the demoapp using the Cypress hook.");
        }
      })
    }
  })
});
