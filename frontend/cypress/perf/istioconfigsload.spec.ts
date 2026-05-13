import { reportFilePath, measureListsLoadTime, measureDetailsLoadTime, baselines } from './common';

describe('Istio Configs performance tests', () => {
  beforeEach(() => {
    cy.env(['USERNAME', 'PASSWD']).then(({ USERNAME, PASSWD }) => {
      cy.login(USERNAME, PASSWD);
    });
  });

  describe('Istio Configs list page', () => {
    let configsUrl;
    let configsUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          configsUrl = encodeURI(`/console/istio?namespaces=${data.namespaces}`);
          configsUrlAllNamespaces = encodeURI(`/console/istio?namespaces=${data.allNamespaces}`);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Istio Configs List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Istio Configs load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureListsLoadTime(
        'All Namespaces Istio Configs',
        Cypress.expose(baselines).configListAdd,
        configsUrlAllNamespaces
      );
    });
    it('Measures Istio Configs load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureListsLoadTime(
        'Selected Namespaces Istio Configs',
        Cypress.expose(baselines).configListSelected,
        configsUrl
      );
    });
  });

  describe('Istio Config details page', () => {
    let configUrls = new Map<string, string>();

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          const overviewUrl = encodeURI(
            `/console/namespaces/${data.detailsNs}/istio/${data.configGroup}/${data.configVersion}/${data.configKind}/${data.configName}`
          );
          configUrls.set('Istio Config Overview', overviewUrl);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Istio Config details page]\n', { flag: 'a+' });
    });

    it('Istio Config details load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      configUrls.forEach((url, name) => {
        measureDetailsLoadTime(name, Cypress.expose(baselines).configDetails, url);
      });
    });
  });
});
