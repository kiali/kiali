import { After, And, Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { getColWithRowText } from './table';
import { ensureKialiFinishedLoading } from "./transition";

When('user clicks in the {string} Istio config actions', (action) => {
  cy.get('button[data-test="config-actions-dropdown"]')
      .click()
      .get('#loading_kiali_spinner')
      .should('not.exist');

  cy.get('a[data-test="create_' + action + '"]')
      .click()
      .get('#loading_kiali_spinner')
      .should('not.exist');
});

And('user sees the {string} config wizard', (title) => {
  cy.get('h1').should('contain.text', title);
});

And('user adds listener', () => {
  cy.get('button[name="addListener"]').click()
});

And('user types {string} in the name input', (name) => {
  cy.get('input[id="name0"]').type(name);
});

And('user types {string} in the add listener name input', (name) => {
  cy.get('input[id="addName0"]').type(name);
});

And('user types {string} in the add hostname input', (host) => {
  cy.get('input[id="addHostname0"]').type(host);
});

And('user types {string} in the add port input', (port) => {
  cy.get('input[id="addPort0"]').type(port);
});

And('user creates the istio config', () => {
  cy.get('button[data-test="create"]')
      .click()
  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner')
        .should('not.exist');
  });
});

Then('the K8sGateway {string} should be listed in {string} namespace', function(name, namespace: string) {
  cy.get(`[data-test=VirtualItem_Ns${namespace}_k8sgateway_${name}] svg`).should('exist');
});
