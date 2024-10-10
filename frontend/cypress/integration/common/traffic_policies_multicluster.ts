import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

const authorizationPolicies: string[] = [
  'deny-all-bookinfo',
  'details-v1',
  'productpage-v1',
  'ratings-v1',
  'reviews-v1',
  'reviews-v2',
  'reviews-v3'
];
const sidecars: string[] = [
  'kiali-traffic-generator',
  'details-v1',
  'productpage-v1',
  'ratings-v1',
  'reviews-v1',
  'reviews-v2',
  'reviews-v3'
];

When('user deletes a Traffic Policy and the resource is no longer available in any cluster', () => {
  authorizationPolicies.forEach(policy => {
    cy.request({
      failOnStatusCode: false,
      url: `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}?clusterName=east`,
      method: 'DELETE'
    });
    cy.request({
      failOnStatusCode: false,
      url: `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}?clusterName=west`,
      method: 'DELETE'
    });
  });
  sidecars.forEach(sidecar => {
    cy.request({
      failOnStatusCode: false,
      url: `/api/namespaces/bookinfo/istio/networking.istio.io/v1/Sidecar/${sidecar}?clusterName=east`,
      method: 'DELETE'
    });
    cy.request({
      failOnStatusCode: false,
      url: `/api/namespaces/bookinfo/istio/networking.istio.io/v1/Sidecar/${sidecar}?clusterName=west`,
      method: 'DELETE'
    });
  });
});

When(
  'user decides to {string} a Traffic Policy in the {string} {string}',
  (action: string, cluster: string, ns: string) => {
    ensureKialiFinishedLoading();
    cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).find('[aria-label="Actions"]').should('be.visible').click();
    cy.get('button')
      .contains(`${action[0].toUpperCase() + action.slice(1)} Traffic Policies`)
      .should('be.visible');
    cy.get('button')
      .contains(`${action[0].toUpperCase() + action.slice(1)} Traffic Policies`)
      .click();
    ensureKialiFinishedLoading();
  }
);

When('user confirms to {string} the Traffic Policy', (action: string) => {
  if (action === 'create' || action === 'update') {
    cy.get(`button[data-test="${action}"]`).click();
  }
  cy.get('button[data-test="confirm-create"]').click();
  ensureKialiFinishedLoading();
});

Then('user sees the generated Traffic policy objects located in the {string} cluster', (cluster: string) => {
  authorizationPolicies.forEach(policy => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_AuthorizationPolicy_${policy}"]`)
      .scrollIntoView()
      .should('be.visible');
  });
  sidecars.forEach(sidecar => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_Sidecar_${sidecar}"]`)
      .scrollIntoView()
      .should('be.visible');
  });
});

Then('user should not see the generated Traffic policy objects located in the {string} cluster', (cluster: string) => {
  authorizationPolicies.forEach(policy => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_AuthorizationPolicy_${policy}"]`).should('not.exist');
  });
  sidecars.forEach(sidecar => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Nsbookinfo_Sidecar_${sidecar}"]`).should('not.exist');
  });
});
