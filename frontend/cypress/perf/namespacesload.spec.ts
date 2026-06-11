import { reportFilePath, measureListsLoadTime, baselines } from './common';

describe('Namespaces performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Namespaces list page', () => {
    let unhealthyNamespacesUrl: string;
    let namespacesUrlAllNamespaces: string;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          unhealthyNamespacesUrl = encodeURI(
            `/console/namespaces?duration=${data.duration}&refresh=${data.refresh}&health=Failure&health=Not+Ready&health=Degraded&opLabel=or`
          );
          namespacesUrlAllNamespaces = encodeURI(
            `/console/namespaces?duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Namespaces List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('All Namespaces', Cypress.env(baselines).namespaceListAll, namespacesUrlAllNamespaces);
    });

    it('Measures Unhealthy Namespaces load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime(
        'Unhealthy Namespaces',
        Cypress.env(baselines).namespaceListUnhealthy,
        unhealthyNamespacesUrl
      );
    });
  });
});
