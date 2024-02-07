export const reportFilePath = 'cypress/results/performance.txt';

export const visits = 5;

export function measureListsLoadTime(name: string, visits: number, listUrl: string): void {
  // Getting an average to smooth out the results.
  let sum = 0;
  const visitsArray = Array.from({ length: visits });

  cy.wrap(visitsArray)
    .each(() => {
      // Disabling refresh so that we can see how long it takes to load the page without additional requests
      // being made due to the refresh.
      cy.visit(listUrl, {
        onBeforeLoad(win) {
          win.performance.mark('start');
        }
      })
        .its('performance')
        .then(performance => {
          // when namespace does not exist in system, the unhandled promise rejection is thrown
          cy.on('uncaught:exception', (err, runnable) => {
            return false;
          });

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
      sum = sum / visitsArray.length;

      const contents = `${name} list load time: ${(sum / 1000).toPrecision(5)} seconds\n`;
      cy.writeFile(reportFilePath, contents, { flag: 'a+' });
    });
}

export function measureDetailsLoadTime(name: string, visits: number, detailsUrl: string): void {
  // Getting an average to smooth out the results.
  let sum = 0;
  const visitsArray = Array.from({ length: visits });

  cy.wrap(visitsArray)
    .each(() => {
      // Disabling refresh so that we can see how long it takes to load the page without additional requests
      // being made due to the refresh.
      cy.visit(detailsUrl, {
        onBeforeLoad(win) {
          win.performance.mark('start');
        }
      })
        .its('performance')
        .then(performance => {
          cy.get('.pf-v5-c-tabs').should('be.visible');

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
      sum = sum / visitsArray.length;

      const contents = `${name} load time: ${(sum / 1000).toPrecision(5)} seconds\n`;
      cy.writeFile(reportFilePath, contents, { flag: 'a+' });
    });
}

