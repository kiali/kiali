import { reportFilePath, measureListsLoadTime, measureDetailsLoadTime, baselines } from './common';

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
      measureListsLoadTime(
        'All Namespaces Workloads',
        Cypress.env(baselines).workloadListAll,
        workloadsUrlAllNamespaces
      );
    });
    it('Measures Workloads load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureListsLoadTime('Selected Namespaces Workloads', Cypress.env(baselines).workloadListSelected, workloadsUrl);
    });
  });

  describe('Workload details page', () => {
    let workloadUrls = new Map<string, string>();

    before(() => {
      cy.fixture('commonParams.json')
        .then(data => {
          const overviewUrl = encodeURI(
            `/console/namespaces/${data.detailsNs}/workloads/${data.workloadName}?duration=${data.duration}&refresh=${data.refresh}&rangeDuration=${data.rangeDuration}`
          );
          workloadUrls.set('Workload Overview', overviewUrl);
          workloadUrls.set('Workload Traffic', `${overviewUrl}&tab=traffic`);
          workloadUrls.set('Workload Logs', `${overviewUrl}&tab=logs`);
          workloadUrls.set('Workload Inbound Metrics', `${overviewUrl}&tab=in_metrics`);
          workloadUrls.set('Workload Outbound Metrics', `${overviewUrl}&tab=out_metrics`);
          workloadUrls.set('Workload Traces', `${overviewUrl}&tab=traces`);
          workloadUrls.set('Workload Envoy Clusters', `${overviewUrl}&tab=envoy&envoyTab=clusters`);
          workloadUrls.set('Workload Envoy Listeners', `${overviewUrl}&tab=envoy&envoyTab=listeners`);
          workloadUrls.set('Workload Envoy Routes', `${overviewUrl}&tab=envoy&envoyTab=routes`);
          workloadUrls.set('Workload Envoy Bootstrap', `${overviewUrl}&tab=envoy&envoyTab=bootstrap`);
          workloadUrls.set('Workload Envoy Config', `${overviewUrl}&tab=envoy&envoyTab=config`);
          workloadUrls.set('Workload Envoy Metrics', `${overviewUrl}&tab=envoy&envoyTab=metrics`);
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Workload details page]\n', { flag: 'a+' });
    });

    it('Workload details load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      workloadUrls.forEach((url, name) => {
        measureDetailsLoadTime(name, Cypress.env(baselines).workloadDetails, url);
      });
    });
  });
});
