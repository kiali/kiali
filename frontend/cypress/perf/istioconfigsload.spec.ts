import { reportFilePath, measureListsLoadTime, measureDetailsLoadTime, baselines } from './common';

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
          configsUrl = encodeURI(`/console/istio?namespaces=${data.namespaces}`);
          configsUrlAllNamespaces = encodeURI(`/console/istio?namespaces=${data.allNamespaces}`);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Istio Configs List page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Istio Configs load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime(
        'All Namespaces Istio Configs',
        Cypress.env(baselines).configListAll,
        configsUrlAllNamespaces
      );
    });
    it('Measures Istio Configs load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Istio Configs', Cypress.env(baselines).configListSelected, configsUrl);
    });
  });

  describe('Istio Config details page', () => {
    let configUrls = new Map<string, string>();

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          const overviewUrl = encodeURI(
            `/console/namespaces/${data.detailsNs}/istio/${data.configType}/${data.configName}`
          );
          configUrls.set('Istio Config Overview', overviewUrl);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Istio Config details page]\n', { flag: 'a+' });
    });

    it('Istio Config details load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      configUrls.forEach((url, name) => {
        measureDetailsLoadTime(name, Cypress.env(baselines).configDetails, url);
      });
    });
  });
});
