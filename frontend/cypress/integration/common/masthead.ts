import { After, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Then('user sees {string} cluster label with a {string} icon', (clusterName: string, iconType: string) => {
  cy.get('[data-test="cluster-icon"]').should('contain', clusterName);
  cy.get(`[data-test="istio-status-${iconType}"]`).should('be.visible');
});

When('user hovers over the cluster icon', () => {
  cy.get('[data-test="cluster-icon"]').trigger('mouseenter');
});

After({ tags: '@component-health' }, () => {
  cy.get('[data-test="cluster-icon"]').trigger('mouseleave');
});

Then('user sees a tooltip with text {string}', (text: string) => {
  cy.get('[data-test="component-status-tooltip"]').within(() => {
    cy.contains(text).should('be.visible');
  });
});

Then('user does not see any {string} in the tooltip', (status: string) => {
  cy.get('[data-test="component-status-tooltip"]').within(() => {
    cy.contains(status).should('not.exist');
  });
});

When(
  'user scales to {string} the {string} in namespace {string}',
  (scale: string, targetWorkload: string, targetNamespace: string) => {
    cy.exec(`kubectl scale -n ${targetNamespace} --replicas=${scale} deployment/${targetWorkload}`);
    cy.exec(`kubectl rollout status deployment ${targetWorkload} -n ${targetNamespace}`);
  }
);

After({ tags: '@component-health-upscale' }, () => {
  cy.exec(`kubectl scale -n istio-system --replicas=1 deployment/grafana`);
  cy.exec(`kubectl rollout status deployment prometheus -n istio-system`);
});
