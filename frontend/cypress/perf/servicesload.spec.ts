import { reportFilePath, measureListsLoadTime, visits, measureDetailsLoadTime } from './common';

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

  describe('Service details page', () => {
    let serviceUrls = new Map<string, string>();

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          const overviewUrl = encodeURI(
            `/console/namespaces/${data.detailsNs}/services/${data.serviceName}?duration=${data.duration}&refresh=${data.refresh}&rangeDuration=${data.rangeDuration}`
          );
          serviceUrls.set('Service Overview', overviewUrl);
          serviceUrls.set('Service Traffic', `${overviewUrl}&tab=traffic`);
          serviceUrls.set('Service Inbound Metrics', `${overviewUrl}&tab=in_metrics`);
          serviceUrls.set('Service Traces', `${overviewUrl}&tab=traces`);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Service details page]\n', { flag: 'a+' });
    });

    it('Service details load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      serviceUrls.forEach((url, name) => {
        measureDetailsLoadTime(name, visits, url);
      });
    });
  });
});
