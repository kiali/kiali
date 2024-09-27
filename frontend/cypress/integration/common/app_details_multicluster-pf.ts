import { Given, Step, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { openTab } from './transition';
import { clusterParameterExists } from './navigation';
import { ensureKialiFinishedLoading } from './transition';
import { nodeInfo } from './graph-pf';

Then('user sees details information for the remote {string} app', (name: string) => {
  cy.getBySel('app-description-card').within(() => {
    cy.get('#pfbadge-A').parent().parent().parent().contains(name); // App
    cy.get('#pfbadge-W').parent().parent().parent().contains(`${name}-v1`); // Workload
    cy.get('#pfbadge-S').parent().parent().parent().contains(name); // Service

    clusterParameterExists(true);
  });
});

Then(
  'user sees {string} metrics information for the remote {string} {string}',
  (metrics: string, name: string, type: string) => {
    cy.intercept(`**/api/namespaces/bookinfo/${type}s/${name}/dashboard*`).as('fetchMetrics');

    openTab(`${metrics} Metrics`);
    cy.wait('@fetchMetrics');
    cy.waitForReact(1000, '#root');

    cy.getReact('IstioMetricsComponent', { props: { 'data-test': `${metrics.toLowerCase()}-metrics-component` } })
      // HOCs can match the component name. This filters the HOCs for just the bare component.
      .then(
        (metricsComponents: any) =>
          metricsComponents.filter((component: any) => component.name === 'IstioMetricsComponent')[0]
      )
      .getCurrentState()
      .then(state => {
        cy.wrap(state.dashboard).should('not.be.empty');
      });
  }
);

Then('user does not see any inbound and outbound traffic information', () => {
  openTab('Traffic');

  cy.get('h5').contains('No Inbound Traffic');
  cy.get('h5').contains('No Outbound Traffic');
});

Then(
  'user does not see {string} metrics information for the {string} {string} {string}',
  (metrics: string, cluster: string, name: string, type: string) => {
    cy.intercept(`**/api/namespaces/bookinfo/${type}s/${name}/dashboard*&clusterName=${cluster}*`).as('fetchMetrics');

    openTab(`${metrics} Metrics`);
    cy.wait('@fetchMetrics');

    cy.get('[data-test="metrics-chart"]').each($el => {
      cy.wrap($el).should('contain.text', 'No data available');
    });
  }
);

Then('user sees {string} from a remote {string} cluster in the patternfly graph', (type: string, cluster: string) => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const apps = state.cy.nodes(`[cluster="${cluster}"][nodeType="${type}"][namespace="bookinfo"]`).length;
      assert.isAbove(apps, 0);
    });
});

Then('user should see columns related to cluster info for the inbound and outbound traffic', () => {
  cy.get(`th[data-label="Cluster"]`).should('be.visible').and('have.length', 2);
});

Then('an info message {string} is displayed', (message: string) => {
  ensureKialiFinishedLoading();
  cy.contains(message).should('be.visible');
});

// And user clicks on the "reviews" <type> from the "west" cluster visible in the graph
Given(
  'the {string} {string} from the {string} cluster is visible in the patternfly minigraph',
  (name: string, type: string, cluster: string) => {
    Step(this, 'user sees a patternfly minigraph');
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            const { nodeType, isBox } = nodeInfo(type, graphType);
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                cy.wrap(
                  state.cy
                    .nodes()
                    .some(
                      node =>
                        node.data('nodeType') === nodeType &&
                        node.data('namespace') === 'bookinfo' &&
                        node.data(type) === name &&
                        node.data('cluster') === cluster &&
                        node.data('isBox') === isBox
                    )
                ).should('be.true');
              });
          });
      });
  }
);

When(
  'user clicks on the {string} {string} from the {string} cluster in the patternfly graph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('CytoscapeGraph')
      .should('have.length', '1')
      .then($graph => {
        cy.wrap($graph)
          .getProps()
          .then(props => {
            const graphType = props.graphData.fetchParams.graphType;
            cy.wrap($graph)
              .getCurrentState()
              .then(state => {
                const node = state.cy
                  .nodes()
                  .toArray()
                  .find(node => {
                    const { nodeType, isBox } = nodeInfo(type, graphType);
                    return (
                      node.data('nodeType') === nodeType &&
                      node.data('namespace') === 'bookinfo' &&
                      node.data(type) === name &&
                      node.data('cluster') === cluster &&
                      node.data('isBox') === isBox &&
                      !node.data('isInaccessible')
                    );
                  });
                node.emit('tap');
              });
          });
      });
  }
);
