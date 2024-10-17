import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { openTab } from './transition';
import { clusterParameterExists } from './navigation';
import { ensureKialiFinishedLoading } from './transition';
import { elems, nodeInfo } from './graph-pf';
import { Visualization } from '@patternfly/react-topology';

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

Then('user sees {string} from a remote {string} cluster in the minigraph', (type: string, cluster: string) => {
  cy.waitForReact();
  cy.getReact('MiniGraphCardPFComponent', { state: { isReady: true } })
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);
      const filteredNodes = nodes.filter(n => n.getData().cluster === cluster && n.getData().nodeType === type);
      assert.isAbove(filteredNodes.length, 0, 'Unexpected number of nodes');
    });
});

Then('user should see columns related to cluster info for the inbound and outbound traffic', () => {
  cy.get(`th[data-label="Cluster"]`).should('be.visible').and('have.length', 2);
});

Then('an info message {string} is displayed', (message: string) => {
  ensureKialiFinishedLoading();
  cy.contains(message).should('be.visible');
});

Given(
  'the {string} {string} from the {string} cluster is visible in the minigraph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('MiniGraphCardPFComponent', { state: { isReady: true } })
      .should('have.length', '1')
<<<<<<< HEAD
      .getCurrentState()
      .then(state => {
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());

        const graphType = controller.getGraph().getData().graphData.fetchParams.graphType;
        const { nodeType, isBox } = nodeInfo(type, graphType);

        const { nodes } = elems(controller);
        const nodeExists = nodes.some(
          node =>
            node.getData().nodeType === nodeType &&
            node.getData().namespace === 'bookinfo' &&
            node.getData().cluster === cluster &&
            node.getData().isBox === isBox
        );

=======
      .then($graph => {
        const { props, state } = $graph[0];
        const graphType = props.dataSource.fetchParameters.graphType;
        const { nodeType, isBox } = nodeInfo(type, graphType);
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());
        const { nodes } = elems(controller);

        const nodeExists = nodes.some(
          node =>
            node.getData().nodeType === nodeType &&
            node.getData().namespace === 'bookinfo' &&
            node.getData().cluster === cluster &&
            node.getData().isBox === isBox
        );

>>>>>>> 9c89c739c (workaround to avoid cypress crashing due to react lib)
        assert(nodeExists, `Node ${name} of type ${type} from cluster ${cluster} not found in the graph`);
      });
  }
);

When(
  'user clicks on the {string} {string} from the {string} cluster in the minigraph',
  (name: string, type: string, cluster: string) => {
    cy.waitForReact();
    cy.getReact('MiniGraphCardPFComponent', { state: { isReady: true } })
      .should('have.length', '1')
<<<<<<< HEAD
      .getCurrentState()
      .then(state => {
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());

        const graphType = controller.getGraph().getData().graphData.fetchParams.graphType;
        const { nodeType, isBox } = nodeInfo(type, graphType);

        const { nodes } = elems(controller);
        const node = nodes.find(
          node =>
            node.getData().nodeType === nodeType &&
            node.getData().namespace === 'bookinfo' &&
            node.getData().type === name &&
            node.getData().cluster === cluster &&
            node.getData().isBox === isBox &&
            !node.getData().isInaccessible
        );

=======
      .then($graph => {
        const { props, state } = $graph[0];
        const graphType = props.dataSource.fetchParameters.graphType;
        const { nodeType, isBox } = nodeInfo(type, graphType);
        const controller = state.graphRefs.getController() as Visualization;
        assert.isTrue(controller.hasGraph());
        const { nodes } = elems(controller);

        const node = nodes.find(
          node =>
            node.getData().nodeType === nodeType &&
            node.getData().namespace === 'bookinfo' &&
            node.getData().cluster === cluster &&
            node.getData().isBox === isBox &&
            !node.getData().isInaccessible
        );
        assert(node, `Node ${name} of type ${type} from cluster ${cluster} not found in the graph`);

>>>>>>> 9c89c739c (workaround to avoid cypress crashing due to react lib)
        cy.get(`[data-id=${node?.getId()}]`).click();
      });
  }
);
