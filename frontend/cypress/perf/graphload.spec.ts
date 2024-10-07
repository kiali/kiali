import { baselines, measureGraphLoadTime, reportFilePath } from './common';

describe('Graph performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Graph page', () => {
    let graphUrl;
    let graphUrlAllNamespaces;

    before(() => {
      cy.fixture('commonParams')
        .then(data => {
          graphUrl = encodeURI(
            `/console/graphpf/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}`
          );
          graphUrlAllNamespaces = encodeURI(
            `/console/graphpf/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Graph page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Graph load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime('All Namespaces Graph', Cypress.env(baselines).graphAll, graphUrlAllNamespaces);
    });
    it('Measures Graph load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime('Selected Namespaces Graph', Cypress.env(baselines).graphSelected, graphUrl);
    });
  });
});
