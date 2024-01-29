import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');
const authorizationPolicies: string[] = ['deny-all-bookinfo', 'details-v1', 'productpage-v1','ratings-v1','reviews-v1','reviews-v2','reviews-v3'];
const sidecars: string[] = ['kiali-traffic-generator', 'details-v1', 'productpage-v1','ratings-v1','reviews-v1','reviews-v2','reviews-v3'];

When('user deletes a Traffic Policy and the resource is no longer available in any cluster',() => {
  authorizationPolicies.forEach((policy) => {
    cy.request({failOnStatusCode:false,
                url:`/api/namespaces/bookinfo/istio/authorizationpolicies/${policy}?clusterName=east`,
                method:'DELETE'});
    cy.request({failOnStatusCode:false,
                url:`/api/namespaces/bookinfo/istio/authorizationpolicies/${policy}?clusterName=west`,
                method:'DELETE'});
  });
  sidecars.forEach((sidecar) => {
  cy.request({failOnStatusCode:false,
                url:`/api/namespaces/bookinfo/istio/sidecars/${sidecar}?clusterName=east`,
                method:'DELETE'});
    cy.request({failOnStatusCode:false,
                url:`/api/namespaces/bookinfo/istio/sidecars/${sidecar}?clusterName=west`,
                method:'DELETE'});
  });
});

When('user decides to {string} a Traffic Policy in the {string} {string}',(action:string,cluster:string,ns:string) =>{
  cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).find('[aria-label="Actions"]').click();
  cy.get('button').contains(`${action[0].toUpperCase() + action.slice(1)} Traffic Policies`).should('be.visible');
  cy.get('button').contains(`${action[0].toUpperCase() + action.slice(1)} Traffic Policies`).click();

  ensureKialiFinishedLoading();
});

Then('user sees the generated Traffic policy objects located in the {string} cluster', (cluster:string) => {
  authorizationPolicies.forEach((policy) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_authorizationpolicy_${policy}"]`).scrollIntoView().should('be.visible');
  });
  sidecars.forEach((sidecar) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_sidecar_${sidecar}"]`).scrollIntoView().should('be.visible');
  });
});

Then('user should not see the generated Traffic policy objects located in the {string} cluster',(cluster:string) => {
  authorizationPolicies.forEach((policy) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_authorizationpolicy_${policy}"]`).should('not.exist');
  });
  sidecars.forEach((sidecar) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_sidecar_${sidecar}"]`).should('not.exist');
  });
});
