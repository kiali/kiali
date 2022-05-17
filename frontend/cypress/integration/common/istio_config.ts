import { And, Given, Then, When } from 'cypress-cucumber-preprocessor/steps';
import { getColWithRowText } from './table';

function minimalAuthorizationPolicy(name: string, namespace: string): string {
  return `{
    "apiVersion": "security.istio.io/v1beta1",
    "kind": "AuthorizationPolicy",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    }
}`;
}

Given('a {string} AuthorizationPolicy in the {string} namespace', function (name: string, namespace: string) {
  cy.exec(`kubectl delete AuthorizationPolicy ${name} -n ${namespace}`, { failOnNonZeroExit: false });
  cy.exec(`echo '${minimalAuthorizationPolicy(name, namespace)}' | kubectl apply -f -`);
  this.targetNamespace = namespace;
  this.targetAuthorizationPolicy = name;
});

Given('the AuthorizationPolicy has a from-source rule for {string} namespace', function (namespace: string) {
  cy.exec(`kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"from":[{"source": {"namespaces":["${namespace}"]}}]}]}}'`)
});

Given('the AuthorizationPolicy has a to-operation rule with {string} method', function (method: string) {
  cy.exec(`kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"methods":["${method}"]}}]}]}}'`)
});

Given('the AuthorizationPolicy has a to-operation rule with {string} host', function (host: string) {
  cy.exec(`kubectl patch AuthorizationPolicy ${this.targetAuthorizationPolicy} -n ${this.targetNamespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"hosts":["${host}"]}}]}]}}'`)
});

When('the user fetches the list of Istio resources', function () {
  cy.visit('/console/istio?refresh=0');
});

And('user filters for config {string}', (configName: string) => {
  cy.get('select[aria-label="filter_select_value"]').select(configName);
});

Then('user sees all the Istio Config objects in the bookinfo namespace', () => {
  // There should be two Istio Config objects in the bookinfo namespace
  // represented by two rows in the table.
  cy.get('tbody').within(() => {
    // Bookinfo VS
    cy.get('tr').contains('bookinfo');
    // Bookinfo Gateway
    cy.get('tr').contains('bookinfo-gateway');
  });
});

And('user sees Name information for Istio objects', () => {
  const object = 'bookinfo-gateway';
  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Name').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

And('user sees Namespace information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Namespace').contains('bookinfo');
});

And('user sees Type information for Istio objects', () => {
  const object = 'bookinfo-gateway';

  getColWithRowText(object, 'Type').contains('Gateway');
});

And('user sees Configuration information for Istio objects', () => {
  const object = 'bookinfo-gateway';
  // There should be a table with a heading for each piece of information.
  getColWithRowText(object, 'Configuration').within(() => {
    cy.get(`a[href*="/namespaces/bookinfo/istio/gateways/${object}"]`).should('be.visible');
  });
});

And('the user filters by {string} for {string}', (filter: string, filterValue: string) => {
  if (filter === 'Istio Name') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_value"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Istio Type') {
    cy.get('select[aria-label="filter_select_type"]').select('Istio Type');
    cy.get('input[placeholder="Filter by Istio Type"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Config') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'App Name') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_value"]').type(`${filterValue}{enter}`);
  } else if (filter === 'Istio Sidecar') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'Health') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('select[aria-label="filter_select_value"]').select(filterValue);
  } else if (filter === 'Label') {
    cy.get('select[aria-label="filter_select_type"]').select(filter);
    cy.get('input[aria-label="filter_input_label_key"]').type(`${filterValue}{enter}`);
  }
});

Then('user only sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);
  cy.get('tbody').within(() => {
    cy.get('tr').should('have.length', 1);
  });
});

Then('user sees {string}', (sees: string) => {
  cy.get('tbody').contains('tr', sees);
});

Then('the user can create a {string} Istio object', (object: string) => {
  cy.getBySel('actions-dropdown').click();
  cy.getBySel('actions-dropdown').within(() => {
    cy.contains(object).click();
  });
  const page = `/istio/new/${object}`;
  cy.url().should('include', page);
});

Then('the AuthorizationPolicy should have a {string}', function(healthStatus: string) {
  cy.get(`[data-test=VirtualItem_Ns${this.targetNamespace}_${this.targetAuthorizationPolicy}] svg`)
      .invoke('attr', 'style')
      .should('have.string', `${healthStatus}-color`);
});