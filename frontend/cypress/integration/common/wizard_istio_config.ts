import { And, Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks in the {string} Istio config actions', (action: string) => {
  cy.get('button[data-test="config-actions-dropdown"]')
      .click()
      .get('#loading_kiali_spinner')
      .should('not.exist');

  cy.get('a[data-test="create_' + action + '"]')
      .click()
      .get('#loading_kiali_spinner')
      .should('not.exist');
});

And('user sees the {string} config wizard', (title: string) => {
  cy.get('h1').should('contain.text', title);
});

And('user adds listener', () => {
  cy.get('button[name="addListener"]').click()
});

And('user types {string} in the name input', (name: string) => {
  cy.get('input[id="name"]').type(name);
});

And('user types {string} in the add listener name input', (name: string) => {
  cy.get('input[id="addName0"]').type(name);
});

And('user checks validation of the hostname input', () => {
  cy.inputValidation('addHostname0', 'host', false); // hostname must be fqdn
  cy.inputValidation('addHostname0', '1.1.1.1', false); // IPs are not allowed
  cy.inputValidation('addHostname0', 'namespace/host', false); // namespace/dns format is not allowed
  cy.inputValidation('addHostname0', '*.hostname.com', true); // domain name with wildcard prefix is allowed
  cy.inputValidation('addHostname0', '*.hostname.*.com', false); // but not wildcards in the middle
  cy.inputValidation('addHostname0', '*', false); // or just a wildcard
  cy.inputValidation('addHostname0', 'HOST.com', false); // capital letters are not allowed
});

And('user types {string} in the add hostname input', (host: string) => {
  cy.get('input[id="addHostname0"]').type(host);
});

And('user types {string} in the add port input', (port: string) => {
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

Then('the K8sGateway {string} should be listed in {string} namespace', function(name: string, namespace: string) {
  cy.get(`[data-test=VirtualItem_Ns${namespace}_k8sgateway_${name}] svg`).should('exist');
});
