import { reportFilePath } from './constants';

describe('Apps performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  describe('Apps list page', () => {
    let appsUrl;

    before(() => {
      cy.fixture('appsParams.json')
        .then(data => {
          appsUrl = encodeURI(
            `/console/applications/namespaces?&namespaces=${data.namespaces}&duration=${data.duration}&refresh=${data.refresh}`
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '[App List page]\n\n', { flag: 'a+' });
    });

    it('Measures Apps load time', { defaultCommandTimeout: Cypress.env('timeout') }, () => {
      // Getting an average to smooth out the results.
      let sum = 0;

      const visits = Array.from({ length: 5 });

      cy.wrap(visits)
        .each(() => {
          // Disabling refresh so that we can see how long it takes to load the page without additional requests
          // being made due to the refresh.
          cy.visit(appsUrl, {
            onBeforeLoad(win) {
              win.performance.mark('start');
            }
          })
            .its('performance')
            .then(performance => {
              cy.get('.pf-v5-c-toolbar').should('be.visible');

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
          sum = sum / visits.length;

          const contents = `App list load time: ${(sum / 1000).toPrecision(5)} seconds

   `;
          cy.writeFile(reportFilePath, contents, { flag: 'a+' });
        });
    });
  });
});
