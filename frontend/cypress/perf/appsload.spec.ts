import { reportFilePath, measureListsLoadTime, visits } from './common';

describe('Apps performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Apps list page', () => {
    let appsUrl;
    let appsUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          appsUrl = encodeURI(
            `/console/applications/namespaces?&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
          appsUrlAllNamespaces = encodeURI(
            `/console/applications/namespaces?&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Apps List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Apps load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('All Namespaces Apps', visits, appsUrlAllNamespaces);
    });
    it('Measures Apps load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Apps', visits, appsUrl);
    });
  });
});
