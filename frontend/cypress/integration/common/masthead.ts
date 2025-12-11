import { After, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

function waitForClusterLabelWithIcon(clusterName: string, iconType: string, retries: 10): void {
  if (retries <= 0) {
    throw new Error(`Exceeded max retries waiting for ${clusterName} cluster label with ${iconType} icon`);
  }

  cy.get('[data-test="refresh-button"]').click();
  ensureKialiFinishedLoading();

  const selector = `[data-test="istio-status-${iconType}"]`;
  cy.get('body').then($body => {
    const $element = $body.find(selector);
    if ($element.length > 0 && $element.is(':visible') && $element.text().includes(clusterName)) {
      cy.log(`Found ${clusterName} cluster label with ${iconType} icon`);
      cy.get(selector).should('contain', clusterName);
      cy.get(selector).should('be.visible');
    } else {
      cy.log(`Cluster label not found yet, retries left: ${retries - 1}. Waiting 10s before retry...`);
      cy.wait(10000);
      waitForClusterLabelWithIcon(clusterName, iconType, retries - 1);
    }
  });
}

Then('user sees {string} cluster label with a {string} icon', (clusterName: string, iconType: string) => {
  waitForClusterLabelWithIcon(clusterName, iconType, 10);
});

When('user hovers over the cluster label with a {string} icon', (iconType: string) => {
  cy.get(`[data-test="istio-status-${iconType}"]`).trigger('mouseenter');
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

Then('user sees the offline status icon', () => {
  cy.get('[data-test="offline-status"]').should('be.visible');
});

Then('user sees the minigraph displays offline', () => {
  cy.get('[data-test="minigraph-offline"]').should('be.visible');
  cy.get('[data-test="minigraph-offline"]').contains('offline');
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
  cy.exec(`kubectl rollout status deployment grafana -n istio-system`);
});
