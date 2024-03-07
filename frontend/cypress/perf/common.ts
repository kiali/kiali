export const reportFilePath = 'cypress/results/performance.txt';

export const visits = 5;
const precision = 5;
export const baselines = 'baselines';

before(() => {
  cy.fixture('baselines.json')
    .then(data => {
      Cypress.env(baselines, data);
    })
    .as('data');
});

const measureLoadTime = (name: string, baseline: number, loadUrl: string, loadElementToCheck: string): void => {
  // Getting an average to smooth out the results.
  let sum = 0;
  const visitsArray = Array.from({ length: visits });

  cy.wrap(visitsArray)
    .each(() => {
      // Disabling refresh so that we can see how long it takes to load the page without additional requests
      // being made due to the refresh.
      cy.visit(loadUrl, {
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
          cy.get(loadElementToCheck).should('be.visible');

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

      const contents = `${name} load time: ${compareToBaseline(sum, baseline)}\n`;
      cy.writeFile(reportFilePath, contents, { flag: 'a+' });
    });
};

export const measureListsLoadTime = (name: string, baseline: number, listUrl: string): void => {
  measureLoadTime(name, baseline, listUrl, '.pf-v5-c-toolbar');
};

export const measureDetailsLoadTime = (name: string, baseline: number, detailsUrl: string): void => {
  measureLoadTime(name, baseline, detailsUrl, '.pf-v5-c-tabs');
};

export const compareToBaseline = (resultMS: number, baseline: number): string => {
  // to seconds
  const result = resultMS / 1000;
  const resultSeconds = result.toPrecision(5);
  const difference = baseline - result;

  return `${resultSeconds} sec, baseline: ${baseline} sec, difference: ${formatNumberWithSign(difference)} sec\n`;
};

const formatNumberWithSign = (num: number): string => {
  if (num > 0) {
    return `+${num.toPrecision(precision)}`;
  } else if (num < 0) {
    return `-${Math.abs(num).toPrecision(precision)}`;
  } else {
    return '0';
  }
};
