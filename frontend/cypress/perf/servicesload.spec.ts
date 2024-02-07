import { reportFilePath, measureListsLoadTime, visits } from './common';

describe('Services performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Services list page', () => {
    let servicesUrl;
    let servicesUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          servicesUrl = encodeURI(
            `/console/services/namespaces?&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
          servicesUrlAllNamespaces = encodeURI(
            `/console/services/namespaces?&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Services List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Services load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('All Namespaces Services', visits, servicesUrlAllNamespaces);
    });
    it('Measures Services load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Services', visits, servicesUrl);
    });
  });
});
