import { reportFilePath, measureListsLoadTime, baselines } from './common';

describe('Namespaces performance tests', () => {
  beforeEach(() => {
    cy.env(['USERNAME', 'PASSWD']).then(({ USERNAME, PASSWD }) => {
      cy.login(USERNAME, PASSWD);
    });
  });

  describe('Namespaces list page', () => {
    let namespacesUrl: string;
    let namespacesUrlAllNamespaces: string;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          namespacesUrl = encodeURI(
            `/console/namespaces?namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
          namespacesUrlAllNamespaces = encodeURI(
            `/console/namespaces?namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Namespaces List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureListsLoadTime('All Namespaces', Cypress.expose(baselines).namespaceListAll, namespacesUrlAllNamespaces);
    });

    it('Measures Selected Namespaces load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces', Cypress.expose(baselines).namespaceListSelected, namespacesUrl);
    });
  });
});
