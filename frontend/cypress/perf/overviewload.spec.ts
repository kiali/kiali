import { baselines, compareToBaseline, reportFilePath, visits } from './common';

describe('Overview performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  // Test namespaces should be created before running the perf tests
  describe('Overview page with namespaces', () => {
    before(() => {
      cy.writeFile(reportFilePath, '\n[Overview page]\n\n', { flag: 'a+' });
    });

    it('loads the overview page', () => {
      // Getting an average to smooth out the results.
      let sum = 0;

      const visitsList = Array.from({ length: visits });

      cy.wrap(visitsList)
        .each(() => {
          // Disabling refresh so that we can see how long it takes to load the page without additional requests
          // being made due to the refresh.
          cy.visit('/console/overview?refresh=0', {
            onBeforeLoad(win) {
              win.performance.mark('start');
            }
          })
            .its('performance')
            .then(performance => {
              cy.get('.pf-v5-l-grid').should('be.visible');

              cy.get('#loading_kiali_spinner', { timeout: 300000 })
                .should('not.exist')
                .then(() => {
                  performance.mark('end');
                  performance.measure('initPageLoad', 'start', 'end');

                  const measure = performance.getEntriesByName('initPageLoad')[0];
                  const duration = measure.duration;

                  sum += duration;
                });
            });
        })
        .then(() => {
          sum = sum / visitsList.length;

          const contents = `Init page load time: ${compareToBaseline(sum, Cypress.env(baselines)[`overview`])}\n`;
          cy.writeFile(reportFilePath, contents, { flag: 'a+' });
        });
    });
  });
});
