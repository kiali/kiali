import { And, Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks in the {string} Istio config actions', (action: string) => {
  cy.get('button[data-test="config-actions-dropdown"]')
    .should('be.visible')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');

  cy.get('a[data-test="create_' + action + '"]')
    .should('be.visible')
    .click()
    .get('#loading_kiali_spinner')
    .should('not.exist');
});

And('user sees the {string} config wizard', (title: string) => {
  cy.get('h1').should('contain.text', title);
});

And('user adds listener', () => {
  cy.get('button[name="addListener"]').should('be.visible').click();
});

And('user types {string} in the {string} input', (value: string, id: string) => {
  cy.get(`input[id="${id}"]`).type(value);
});

And('user checks validation of the hostname {string} input', (id: string) => {
  cy.inputValidation(id, 'host', false); // hostname must be fqdn
  cy.inputValidation(id, '1.1.1.1', false); // IPs are not allowed
  cy.inputValidation(id, 'namespace/host', false); // namespace/dns format is not allowed
  cy.inputValidation(id, '*.hostname.com', true); // domain name with wildcard prefix is allowed
  cy.inputValidation(id, '*.hostname.*.com', false); // but not wildcards in the middle
  cy.inputValidation(id, '*', false); // or just a wildcard
  cy.inputValidation(id, 'HOST.com', false); // capital letters are not allowed
});

And('user adds a server to a server list', () => {
  cy.get('[aria-label="Server List"]').find('button').should('be.visible').click();
});

And('the {string} input should display a warning', (id: string) => {
  cy.get(`input[id="${id}"]`).invoke('attr', 'aria-invalid').should('eq', 'true');
});

And('the {string} input should not display a warning', (id: string) => {
  cy.get(`input[id="${id}"]`).invoke('attr', 'aria-invalid').should('eq', 'false');
});

And('user creates the istio config', () => {
  cy.get('button[data-test="create"]').should('be.visible').click();
  it('spinner should disappear', { retries: 3 }, () => {
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

And('user chooses {string} mode from the {string} select', (option: string, id: string) => {
  cy.get(`select[id="${id}"]`).select(option);
});

And('the {string} message should be displayed', (message: string) => {
  cy.get('main').contains(message).should('be.visible');
});

And('user opens the Add Port submenu', () => {
  cy.get('button[id=addServerBtn').should('be.visible').click();
});

Then('the {string} {string} should be listed in {string} namespace', function (
  type: string,
  name: string,
  namespace: string
) {
  cy.get(`[data-test=VirtualItem_Ns${namespace}_${type.toLowerCase()}_${name}] svg`).should('exist');
});

Then('the preview button should be disabled', () => {
  cy.get('[data-test="preview"').should('be.disabled');
});

Then('an error message {string} is displayed', (message: string) => {
  cy.get('h4').contains(message).should('be.visible');
});

Then('the {string} input should be empty', (id: string) => {
  cy.get(`input[id="${id}"]`).should('be.empty');
});
