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
  cy.exec(`kubectl get pods -n bookinfo -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true --sort-by='.metadata.name' |
    grep -E -w '(reviews-v(1|2|3))|ratings-v1|details|productpage-v1|kiali-traffic-generator' |
    awk -F ' ' '{print $2}' |
    grep Running | 
    wc -l`,{failOnNonZeroExit: false}).then((result) => {
    cy.log(result.stdout);
    if (result.stdout == "7" && result.code == 0){
      cy.log("Bookinfo demo app is up and running.");
    } 
    else{
      cy.log("Bookinfo demo app is either broken or not present. Installing now.").log("Removing old bookinfo installations.");
      // is the suite running on openshift?
      cy.exec('kubectl api-versions | grep --quiet "route.openshift.io";', {failOnNonZeroExit:false}).then((result) =>{
        if (result.code == 0){
          cy.exec('../hack/istio/install-bookinfo-demo.sh --delete-bookinfo true').then(()=>{
            cy.exec('../hack/istio/install-bookinfo-demo.sh -tg -in istio-system -a amd64').then(() =>{
              cy.exec(`kubectl patch kiali kiali -n kiali-operator --type=json '-p=[{"op": "add", "path": "/spec/deployment/accessible_namespaces/0", "value":"bookinfo"}]'`).then(()=>{
                cy.exec(`kubectl wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator;` +
                    `kubectl wait --for=condition=Ready pods --all -n bookinfo --timeout 60s || true;` +
                    `kubectl wait --for=condition=Ready pods --all -n bookinfo --timeout 60s;` +
                    `sleep 80;`,{timeout:400*1000});
              });
            })
          })
        }
        else{
          cy.exec('../hack/istio/install-bookinfo-demo.sh --delete-bookinfo true -c kubectl').then(()=>{
            cy.exec('../hack/istio/install-bookinfo-demo.sh -c kubectl -tg -in istio-system -a amd64');
          })
        }
      })
    }
  })
});
