import { reportFilePath, measureListsLoadTime, visits } from './common';

describe('Istio Configs performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Istio Configs list page', () => {
    let configsUrl;
    let configsUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          configsUrl = encodeURI(
            `/console/istio/namespaces?&namespaces=${data.namespaces}`
          );
          configsUrlAllNamespaces = encodeURI(
            `/console/istio/namespaces?&namespaces=${data.allNamespaces}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Istio Configs List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Istio Configs load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('All Namespaces Istio Configs', visits, configsUrlAllNamespaces);
    });
    it('Measures Istio Configs load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Istio Configs', visits, configsUrl);
    });
  });
});
