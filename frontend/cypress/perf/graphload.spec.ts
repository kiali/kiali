import { reportFilePath } from './common';

describe('Graph performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Graph page with workloads', () => {
    let graphUrl;

    before(() => {
      cy.fixture('graphParams')
        .then(data => {
          graphUrl = encodeURI(
            `/console/graph/namespaces?traffic=${data.traffic}&graphType=${data.graphType}&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}&layout=${data.layout}&namespaceLayout=${data.namespaceLayout}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '\n[Graph page With workloads]\n', { flag: 'a+' });
    });

    it('Measures Graph load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      cy.intercept(`**/api/namespaces/graph*`).as('graphNamespaces');

      cy.visit(graphUrl, {
        onBeforeLoad(win) {
          win.performance.mark('start');
        }
      })
        .its('performance')
        .then(performance => {
          cy.wait('@graphNamespaces');

          cy.get('#cy', { timeout: 10000 })
            .should('be.visible')
            .then(() => {
              performance.mark('end');
              performance.measure('pageLoad', 'start', 'end');

              const measure = performance.getEntriesByName('pageLoad')[0];
              const duration = measure.duration;

              assert.isAtMost(duration, Cypress.env('threshold'));

              const contents = `Graph load time for ${graphUrl}: ${(duration / 1000).toPrecision(5)} seconds\n`;
              cy.writeFile(reportFilePath, contents, { flag: 'a+' });
            });
        });
    });
  });
});
