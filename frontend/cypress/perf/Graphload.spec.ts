function namespaceName(index: number) {
  return `perf-testing-${index}`;
}

function createNamespaces(count: number) {
  cy.log(`Creating ${count} namespaces...`);
  for (let i = 1; i <= count; i++) {
    createNamespace(namespaceName(i));
  }
}

function createNamespace(name: string) {
  cy.exec(`kubectl get ns ${name} || kubectl create ns ${name}`);
}

function deleteNamespaces(count: number) {
  cy.log(`Deleting ${count} namespaces...`);
  // Fire off async delete requests then wait for them to complete.
  for (let i = 1; i <= count; i++) {
    deleteNamespace(namespaceName(i));
  }

  cy.log('Waiting for namespaces to be deleted...');
  for (let i = 1; i <= count; i++) {
    cy.exec(`kubectl wait --for=delete --timeout=5m namespace/${namespaceName(i)}`);
  }
}

function deleteNamespace(name: string) {
  cy.exec(`kubectl delete --ignore-not-found=true --wait=false ns ${name}`);
}

describe('Performance tests', () => {
  const reportFilePath = 'logs/performance.txt';

  before(() => {
    // Setup the perf report.
    cy.writeFile(reportFilePath, 'PERFORMANCE REPORT\n\n');

    cy.login(Cypress.env('USERNAME'), Cypress.env('PASSWD'));
  });

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('kiali-token-aes');
  });

  // Testing empty namespaces to understand the impact of adding namespaces alone.
  describe('Overview page with empty namespaces', () => {
    const overviewCases = [
      {
        namespaces: 10
      },
      {
        namespaces: 50
      },
      {
        namespaces: 300
      }
    ];

    before(() => {
      cy.writeFile(reportFilePath, '[Empty Namespaces]\n\n', { flag: 'a+' });
    });

    overviewCases.forEach(function (testCase) {
      describe(`Test with ${testCase.namespaces} empty namespaces`, () => {
        before(() => {
          createNamespaces(testCase.namespaces);
        });

        after(() => {
          deleteNamespaces(testCase.namespaces);
        });

        it('loads the overview page', () => {
          // Disabling refresh so that we can see how long it takes to load the page without additional requests
          // being made due to the refresh.
          cy.visit('/console/overview?refresh=0', {
            onBeforeLoad(win) {
              win.performance.mark('start');
            }
          })
            .its('performance')
            .then(performance => {
              cy.get('.pf-l-grid').should('be.visible');
              cy.get('#loading_kiali_spinner', { timeout: 300000 })
                .should('not.exist')
                .then(() => {
                  performance.mark('end');
                  performance.measure('initPageLoad', 'start', 'end');
                  const measure = performance.getEntriesByName('initPageLoad')[0];
                  const duration = measure.duration;
                  assert.isAtMost(duration, Cypress.env('threshold'));

                  const contents = `Namespaces: ${testCase.namespaces}
  Init page load time: ${(duration / 1000).toPrecision(5)} seconds

`;
                  cy.writeFile(reportFilePath, contents, { flag: 'a+' });
                });
            });
        });
      });
    });
  });

  describe('Graph page with workloads', () => {
    var graphUrl;

    before(() => {
      cy.fixture('graphParams')
        .then(function (data) {
          graphUrl = encodeURI(
            '/console/graph/namespaces?traffic=' +
              data.traffic +
              '&graphType=' +
              data.graphType +
              '&namespaces=' +
              data.namespaces +
              '&duration=' +
              data.duration +
              '&refresh=' +
              data.refresh +
              '&layout=' +
              data.layout +
              '&namespaceLayout=' +
              data.namespaceLayout
          );
        })
        .as('data');

      cy.writeFile(reportFilePath, '[Graph page With workloads]\n\n', { flag: 'a+' });
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

              const contents = `Graph load time for ${graphUrl}: ${(duration / 1000).toPrecision(5)} seconds

  `;
              cy.writeFile(reportFilePath, contents, { flag: 'a+' });
            });
        });
    });
  });
});
