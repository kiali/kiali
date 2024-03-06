import overviewCases from '../fixtures/perf/overviewPage.json';
import { baselines, compareToBaseline, reportFilePath } from './common';

const createNamespaces = (count: number): void => {
  cy.log(`Creating ${count} namespaces...`);

  for (let i = 1; i <= count; i++) {
    const namespaceTemplate = `apiVersion: v1
kind: Namespace
metadata:
  name: perf-testing-${i}
  labels:
    kiali.io: perf-testing
`;

    cy.exec(`printf "${namespaceTemplate}" | kubectl apply -f -`);
  }
};

const deleteNamespaces = (): void => {
  cy.log('Deleting namespaces...');

  // This can take a while to delete. Waiting for 10 mins max.
  cy.exec('kubectl delete --ignore-not-found=true -l kiali.io=perf-testing ns', { timeout: 600000 });
};

type OverviewCase = {
  namespaces: number;
};

describe('Overview performance tests', () => {
  beforeEach(() => {
    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  // Testing empty namespaces to understand the impact of adding namespaces alone.
  describe('Overview page with empty namespaces', () => {
    before(() => {
      cy.writeFile(reportFilePath, '\n[Empty Namespaces]\n\n', { flag: 'a+' });
    });

    (overviewCases as OverviewCase[]).forEach(testCase => {
      describe(`Test with ${testCase.namespaces} empty namespaces`, () => {
        before(() => {
          createNamespaces(testCase.namespaces);
        });

        after(() => {
          deleteNamespaces();
        });

        it('loads the overview page', () => {
          // Getting an average to smooth out the results.
          let sum = 0;

          const visits = Array.from({ length: 5 });

          cy.wrap(visits)
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
              sum = sum / visits.length;

              const contents = `Namespaces: ${testCase.namespaces}\nInit page load time: ${compareToBaseline(
                sum,
                Cypress.env(baselines).overview
              )}\n`;
              cy.writeFile(reportFilePath, contents, { flag: 'a+' });
            });
        });
      });
    });
  });
});
