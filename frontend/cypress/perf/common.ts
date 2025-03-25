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

const measureLoadTime = (
  name: string,
  baseline: number,
  loadUrl: string,
  loadElementToCheck: string,
  isGraph: boolean
): void => {
  // Getting an average to smooth out the results.
  let sum = 0;
  // for graph page load only once, otherwise braking on jenkins
  const visitsArray = Array.from({ length: visits });

  cy.wrap(visitsArray)
    .each(() => {
      // Disabling refresh so that we can see how long it takes to load the page without additional requests
      // being made due to the refresh.
      cy.visit({
        url: loadUrl,
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
          if (isGraph) {
            cy.waitForReact();
            cy.getReact('GraphPageComponent', { state: { isReady: true } }).should('have.length', '1');
            // @TODO this check fails on jenkins with CPU/Memory error, to find a better solution
            // .getCurrentState().then(state => {const controller = state.graphRefs.getController() as Visualization; assert.isTrue(controller.hasGraph()); });
          } else {
            cy.get(loadElementToCheck).should('be.visible');
          }

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

export const measureGraphLoadTime = (name: string, baseline: number, listUrl: string): void => {
  measureLoadTime(name, baseline, listUrl, '', true);
};

export const measureListsLoadTime = (name: string, baseline: number, listUrl: string): void => {
  measureLoadTime(name, baseline, listUrl, '.pf-v5-c-toolbar', false);
};

export const measureDetailsLoadTime = (name: string, baseline: number, detailsUrl: string): void => {
  measureLoadTime(name, baseline, detailsUrl, '.pf-v5-c-tabs', false);
};

export const compareToBaseline = (resultMS: number, baseline: number): string => {
  // to seconds
  const result = resultMS / 1000;
  const resultOutput = result.toPrecision(5);

  return `${resultOutput} sec, baseline: ${baseline} sec, difference: ${getDifference(result, baseline)} sec\n`;
};

const getDifference = (result, baseline: number): string => {
  const difference = result - baseline;
  if (difference > 0) {
    return `+${difference.toPrecision(precision)}`;
  } else if (difference < 0) {
    return `-${Math.abs(difference).toPrecision(precision)}`;
  } else {
    return '0';
  }
};
