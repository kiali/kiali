import { baselines, measureGraphLoadTime, reportFilePath } from './common';

describe('Graph performance tests', () => {
  beforeEach(() => {
    cy.env(['USERNAME', 'PASSWD']).then(({ USERNAME, PASSWD }) => {
      cy.login(USERNAME, PASSWD);
    });
  });

  describe('Graph page', () => {
    let graphUrl;
    let graphUrlAllNamespaces;
    let graphUrlAllNamespacesIdle;

    before(() => {
      cy.fixture('commonParams')
        .then(data => {
          graphUrl = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}`
          );
          graphUrlAllNamespaces = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}`
          );
          graphUrlAllNamespacesIdle = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.allNamespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&idleNodes=true`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Graph page]\n', { flag: 'a+' });
    });

    it('Measures All Namespaces Graph load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureGraphLoadTime('All Namespaces Graph', Cypress.expose(baselines).graphAll, graphUrlAllNamespaces);
    });
    it(
      'Measures All Namespaces Graph Idle Nodes load time',
      { defaultCommandTimeout: Cypress.expose('timeout') },
      () => {
        measureGraphLoadTime(
          'All Namespaces Graph Idle Nodes',
          Cypress.expose(baselines).graphAllIdle,
          graphUrlAllNamespacesIdle
        );
      }
    );
    it('Measures Graph load time', { defaultCommandTimeout: Cypress.expose('timeout') }, () => {
      measureGraphLoadTime('Selected Namespaces Graph', Cypress.expose(baselines).graphSelected, graphUrl);
    });
  });
});
