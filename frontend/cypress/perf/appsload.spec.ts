import { reportFilePath, measureListsLoadTime, measureDetailsLoadTime, baselines } from './common';

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
      measureListsLoadTime('All Namespaces Apps', Cypress.env(baselines).appListAll, appsUrlAllNamespaces);
    });
    it('Measures Apps load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Apps', Cypress.env(baselines).appListSelected, appsUrl);
    });
  });

  describe('App details page', () => {
    let appUrls = new Map<string, string>();

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          const overviewUrl = encodeURI(
            `/console/namespaces/${data.detailsNs}/applications/${data.applicationName}?duration=${data.duration}&refresh=${data.refresh}&rangeDuration=${data.rangeDuration}`
          );
          appUrls.set('App Overview', overviewUrl);
          appUrls.set('App Traffic', `${overviewUrl}&tab=traffic`);
          appUrls.set('App Inbound Metrics', `${overviewUrl}&tab=in_metrics`);
          appUrls.set('App Outbound Metrics', `${overviewUrl}&tab=out_metrics`);
          appUrls.set('App Traces', `${overviewUrl}&tab=traces`);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[App details page]\n', { flag: 'a+' });
    });

    it('App details load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      appUrls.forEach((url, name) => {
        measureDetailsLoadTime(name, Cypress.env(baselines).appDetails, url);
      });
    });
  });
});
