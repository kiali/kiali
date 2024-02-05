import { reportFilePath, measureListsLoadTime, visits } from './common';

describe('Workloads performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Workloads list page', () => {
    let workloadsUrl;
    let workloadsUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          workloadsUrl = encodeURI(
            `/console/workloads/namespaces?&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
          workloadsUrlAllNamespaces = encodeURI(
            `/console/workloads/namespaces?&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Workloads List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Workloads load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('All Namespaces Workloads', visits, workloadsUrlAllNamespaces);
    });
    it('Measures Workloads load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Workloads', visits, workloadsUrl);
    });
  });
});
