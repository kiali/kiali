import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

When('user clicks in the {string} Istio config actions', (action: string) => {
  cy.get('button[data-test="istio-actions-toggle"]')
    .should('be.visible')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');

  cy.get(`li[data-test="create_${action}"]`)
    .find('button')
    .should('be.visible')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');
});

When('viewing the detail for {string}', (object: string) => {
  ensureKialiFinishedLoading();
  cy.get('a').contains(object).should('be.visible').click();
});

When('user deletes k8sgateway named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete gateways.gateway.networking.k8s.io ${name} -n bookinfo`, { failOnNonZeroExit: false });
  ensureKialiFinishedLoading();
});

When('user deletes k8sinferencepool named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete inferencepools.inference.networking.k8s.io ${name} -n bookinfo`, {
    failOnNonZeroExit: false
  });
  ensureKialiFinishedLoading();
});

When('user deletes k8sreferencegrant named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete referencegrants.gateway.networking.k8s.io ${name} -n bookinfo`, { failOnNonZeroExit: false });
  ensureKialiFinishedLoading();
});

When('user deletes gateway named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete gateway.networking.istio.io ${name} -n bookinfo`, { failOnNonZeroExit: false });
  ensureKialiFinishedLoading();
});

When('user deletes sidecar named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete sidecar ${name} -n bookinfo`, { failOnNonZeroExit: false });
  ensureKialiFinishedLoading();
});

When('user deletes service named {string} and the resource is no longer available', (name: string) => {
  cy.exec(`kubectl delete serviceEntries ${name} -n bookinfo`, { failOnNonZeroExit: false });
  ensureKialiFinishedLoading();
});

When('user sees the {string} config wizard', (title: string) => {
  cy.get('h1').should('contain.text', title);
});

When('user adds listener', () => {
  cy.get('button[name="addListener"]').should('be.visible').click();
});

When('user adds a hostname', () => {
  cy.get('button[name="addAddress"]').should('be.visible').click();
});

When('user types {string} in the {string} input', (value: string, id: string) => {
  cy.get(`input[id="${id}"]`).type(value);
});

When('user checks validation of the hostname {string} input', (id: string) => {
  cy.inputValidation(id, 'host', false); // hostname must be fqdn
  cy.inputValidation(id, '1.1.1.1', false); // IPs are not allowed
  cy.inputValidation(id, 'namespace/host', false); // namespace/dns format is not allowed
  cy.inputValidation(id, '*.hostname.com', true); // domain name with wildcard prefix is allowed
  cy.inputValidation(id, '*.hostname.*.com', false); // but not wildcards in the middle
  cy.inputValidation(id, '*', false); // or just a wildcard
  cy.inputValidation(id, 'HOST.com', false); // capital letters are not allowed
});

When('user adds a server to a server list', () => {
  cy.get('button[name="addServer"]').should('be.visible').click();
});

Then('the {string} input should display a warning', (id: string) => {
  cy.get(`input[id="${id}"]`).invoke('attr', 'aria-invalid').should('eq', 'true');
});

Then('the {string} input should not display a warning', (id: string) => {
  cy.get(`input[id="${id}"]`).invoke('attr', 'aria-invalid').should('eq', 'false');
});

When('user creates the istio config', () => {
  cy.get('button[data-test="create"]').should('be.visible').click();

  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

When('user chooses {string} mode from the {string} select', (option: string, id: string) => {
  cy.get(`select[id="${id}"]`).select(option);
});

Then('the {string} message should be displayed', (message: string) => {
  cy.get('main').contains(message).should('be.visible');
});

When('user opens the {string} submenu', (title: string) => {
  cy.get('button').contains(title).should('be.visible').click();
});

When('choosing to delete it', () => {
  cy.get('#actions-toggle').should('be.visible').click();
  cy.get('#actions').contains('Delete').should('be.visible').click();
  cy.get('#pf-modal-part-1').find('button').contains('Delete').should('be.visible').click();
});

When('user closes the success notification', () => {
  cy.get('[aria-label^="Close Success alert: alert: Istio networking.istio.io/v1, Kind=Gateway created"]').click();
});

Then('user does not see a dropdown for cluster selection', () => {
  cy.get('[data-test="cluster-dropdown"]').should('not.exist');
});

Then(
  'the {string} {string} should be listed in {string} namespace',
  (type: string, name: string, namespace: string) => {
    cy.get(`[data-test=VirtualItem_Ns${namespace}_${type}_${name}] svg`).should('exist');
  }
);

Then(
  'the {string} {string} should not be listed in {string} namespace',
  (type: string, name: string, namespace: string) => {
    cy.get(`[data-test=VirtualItem_Ns${namespace}_${type}_${name}] svg`).should('not.exist');
  }
);

Then('the preview button should be disabled', () => {
  cy.get('[data-test="preview"').should('be.disabled');
});

Then('an error message {string} is displayed', (message: string) => {
  cy.get('h4').contains(message).should('be.visible');
});

Then('the {string} input should be empty', (id: string) => {
  cy.get(`input[id="${id}"]`).should('be.empty');
});

Then('{string} should be referenced', (gateway: string) => {
  ensureKialiFinishedLoading();

  cy.get('h5').contains('Validation References').should('be.visible');
  cy.get(`a[data-test="K8sGateway-bookinfo-${gateway}"]`).should('be.visible');
});

Then('{string} should not be referenced anymore', (gateway: string) => {
  ensureKialiFinishedLoading();
  cy.get(`a[data-test="K8sGateway-bookinfo-${gateway}"]`).should('not.exist');
});

Then('{string} details information for service entry {string} can be seen', (host: string, name: string) => {
  cy.get('#ServiceDescriptionCard').within(() => {
    cy.get('#pfbadge-ES').parent().parent().parent().contains(host);
  });

  cy.get('#IstioConfigCard').within(() => {
    cy.get('#pfbadge-SE').parent().parent().contains(name);
  });
});

When('user clicks on Edit Labels', () => {
  cy.get('[data-test="edit-labels"]').click();
});

When('user clicks on Edit Annotations', () => {
  cy.get('[data-test="edit-annotations"]').click();
});

When('user adds key {string} and value {string} for and saves', (key: string, value: string) => {
  cy.get(`input[id="labelInputForKey_0"]`).type(key);
  cy.get(`input[id="labelInputForValue_0"]`).type(value);
  cy.get('button[data-test="save-button"]').click();
});

Then('{string} should be in preview', (value: string) => {
  cy.get('#ace-editor').contains(value);
});

Then('user selects {string} from the cluster dropdown', (clusters: string) => {
  cy.getBySel('cluster-dropdown').click();
  clusters.split(',').forEach(cluster => {
    cy.get(`input[type="checkbox"][value="${cluster}"]`).check();
  });
  cy.getBySel('cluster-dropdown').click();
});

Then(
  'the {string} {string} should not be listed in {string} {string} namespace',
  (type: string, svc: string, cluster: string, ns: string) => {
    cy.get(`[data-test="VirtualItem_Cluster${cluster}_Ns${ns}_${type}_${svc}"]`).should('not.exist');
  }
);
