import { baselines, compareToBaseline, reportFilePath, visits } from './common';

describe('Overview performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Overview page with cards', () => {
    before(() => {
      cy.writeFile(reportFilePath, '\n[Overview page]\n\n', { flag: 'a+' });
    });

    it('loads the overview page', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      let sum = 0;

      const visitsList = Array.from({ length: visits });

      cy.wrap(visitsList)
        .each(() => {
          cy.visit({
            url: '/console/overview?refresh=0',
            onBeforeLoad(win) {
              win.performance.mark('start');
            }
          })
            .its('performance')
            .then(performance => {
              cy.on('uncaught:exception', () => {
                return false;
              });

              // Wait for the main overview cards to be visible
              cy.getBySel('control-planes-card').should('be.visible');
              cy.getBySel('clusters-card').should('be.visible');
              cy.getBySel('data-planes-card').should('be.visible');
              cy.getBySel('apps-card').should('be.visible');
              cy.getBySel('service-insights-card').should('be.visible');

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

          const contents = `Init page load time: ${compareToBaseline(sum, Cypress.env(baselines).overview)}\n`;
          cy.writeFile(reportFilePath, contents, { flag: 'a+' });
        });
    });
  });
});
