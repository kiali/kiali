import { baselines, measureGraphLoadTime, reportFilePath } from './common';

describe('Graph Appender performance tests - Issue #8524', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Graph appender combinations', () => {
    let graphUrlIssueBaseline;
    let graphUrlWithoutIstio;
    let graphUrlOnlyIstio;
    let graphUrlCore;

    before(() => {
      cy.fixture('commonParams')
        .then(data => {
          graphUrlIssueBaseline = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&appenders=deadNode,istio,serviceEntry,meshCheck,workloadEntry,health`
          );
          graphUrlWithoutIstio = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&appenders=deadNode,serviceEntry,meshCheck,workloadEntry,health`
          );
          graphUrlOnlyIstio = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&appenders=istio`
          );
          graphUrlCore = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&appenders=deadNode,serviceEntry`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Graph Appender Performance - Issue #8524]\n', { flag: 'a+' });
    });

    it('Measures Issue Baseline (Full List) load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime(
        'Issue Baseline (Full List)',
        Cypress.env(baselines).graphIssueBaseline,
        graphUrlIssueBaseline
      );
    });
    it('Measures Without Istio (Test Fix) load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime('Without Istio (Test Fix)', Cypress.env(baselines).graphWithoutIstio, graphUrlWithoutIstio);
    });
    it('Measures Only Istio (Isolate Problem) load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime('Only Istio (Isolate Problem)', Cypress.env(baselines).graphOnlyIstio, graphUrlOnlyIstio);
    });
    it('Measures Core Appenders Only load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      measureGraphLoadTime('Core Appenders Only', Cypress.env(baselines).graphCore, graphUrlCore);
    });
  });
});
