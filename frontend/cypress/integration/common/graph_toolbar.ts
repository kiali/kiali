import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { EdgeAttr } from 'types/Graph';
import { elems, select } from './graph';
import { Visualization } from '@patternfly/react-topology';

When(
  'user graphs {string} namespaces with refresh {string} and duration {string}',
  (namespaces: string, refresh: string, duration: string) => {
    cy.visit({
      url: `/console/graph/namespaces?refresh=${refresh}&duration=${duration}&namespaces=${namespaces}`
    });
  }
);

When('user clicks graph tour', () => {
  cy.get('button#graph-tour').click();
});

When('user closes graph tour', () => {
  cy.get('div[role="dialog"]').find('button[aria-label="Close"]').click();
});

When('user {string} traffic menu', (_action: string) => {
  cy.get('button#graph-traffic-dropdown').click();
});

When('user {string} {string} traffic option', (action: string, option: string) => {
  if (action === 'enables') {
    cy.get('div#graph-traffic-menu').find(`input#${option}`).should('exist').check();
  } else {
    cy.get('div#graph-traffic-menu').find(`input#${option}`).should('exist').uncheck();
  }
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user disables all traffic', () => {
  cy.get('div#graph-traffic-menu').within(() => {
    cy.get('input#grpc').should('exist').uncheck();
    cy.get('#loading_kiali_spinner').should('not.exist');
    cy.get('input#http').should('exist').uncheck();
    cy.get('#loading_kiali_spinner').should('not.exist');
    cy.get('input#tcp').should('exist').uncheck();
    cy.get('#loading_kiali_spinner').should('not.exist');
  });
});

When('user clicks graph duration menu', () => {
  cy.get('button#time_range_duration-toggle').click();
});

When(`user selects graph duration {string}`, (duration: string) => {
  cy.get('button#time_range_duration-toggle').click();
  cy.get(`button[id="${duration}"]`).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user clicks graph refresh menu', () => {
  cy.get('button#time_range_refresh-toggle').click();
});

When(`user selects graph refresh {string}`, (refresh: string) => {
  cy.get('button#time_range_refresh-toggle').click();
  cy.get(`button[id="${refresh}"]`).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user selects {string} graph type', (graphType: string) => {
  cy.get('button#graph_type_dropdown-toggle')
    .click()
    .then(() => {
      cy.get('div#graph_type_dropdown').find(`button[id="${graphType}"]`).click();
    });

  cy.get('#loading_kiali_spinner').should('not.exist');
});

Then('user {string} graph tour', (action: string) => {
  if (action === 'sees') {
    cy.get('.pf-v5-c-popover').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('.pf-v5-c-popover').should('not.exist');
  }
});

Then('user sees {string} graph traffic menu', (menu: string) => {
  cy.get('button#graph-traffic-dropdown').invoke('attr', 'aria-expanded').should('eq', 'true');

  cy.get('div#graph-traffic-menu').within(() => {
    if (menu === 'ambient') {
      cy.get('input').should('have.length', 15);
      cy.get('input#ambient').should('exist').should('be.checked');
      cy.get('input#ambientWaypoint').should('exist').should('not.be.checked');
      cy.get('input#ambientZtunnel').should('exist').should('not.be.checked');
      cy.get('input#ambientTotal').should('exist').should('be.checked');
    } else {
      cy.get('input').should('have.length', 11);
    }
    cy.get('input#grpc').should('exist').should('be.checked');
    cy.get('input#grpcReceived').should('exist').should('not.be.checked');
    cy.get('input#grpcRequest').should('exist').should('be.checked');
    cy.get('input#grpcSent').should('exist').should('not.be.checked');
    cy.get('input#grpcTotal').should('exist').should('not.be.checked');
    cy.get('input#http').should('exist').should('be.enabled');
    cy.get('input#httpRequest').should('exist').should('be.checked');
    cy.get('input#tcp').should('exist').should('be.enabled');
    cy.get('input#tcpReceived').should('exist').should('not.be.checked');
    cy.get('input#tcpSent').should('exist').should('be.checked');
    cy.get('input#tcpTotal').should('exist').should('not.be.checked');
  });
});

Then('user does not see graph traffic menu', () => {
  cy.get('button#graph-traffic-dropdown').invoke('attr', 'aria-expanded').should('eq', 'false');
});

Then('user {string} {string} traffic', (action: string, protocol: string) => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false }, isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { edges } = elems(controller);

      const numEdges = select(edges, { prop: EdgeAttr.protocol, op: '=', val: protocol }).length;

      if (action === 'sees') {
        assert.isAbove(numEdges, 0);
      } else {
        assert.equal(numEdges, 0);
      }
    });
});

Then(`user does not see any traffic`, () => {
  cy.get('div#empty-graph').should('be.visible');
});

Then('user sees graph duration menu', () => {
  cy.get('button#time_range_duration-toggle').invoke('attr', 'aria-expanded').should('eq', 'true');

  cy.get('div#time_range_duration').within(() => {
    cy.request({ method: 'GET', url: '/api/config' }).then(response => {
      expect(response.status).to.equal(200);

      const scrapeInterval = response.body.prometheus.globalScrapeInterval;
      const retention = response.body.prometheus.storageTsdbRetention;

      expect(scrapeInterval).within(15, 60);
      expect(retention).gte(21600);

      cy.get('button').should('have.length.within', 7, 11);

      if (scrapeInterval < 60) {
        cy.get('button#60').should('exist');
      } else {
        cy.get('button#60').should('not.exist');
      }

      cy.get('button#120').should('exist');
      cy.get('button#300').should('exist');
      cy.get('button#600').should('exist');
      cy.get('button#1800').should('exist');
      cy.get('button#3600').should('exist');
      cy.get('button#10800').should('exist');
      cy.get('button#21600').should('exist');

      if (retention > 21600) {
        cy.get('button#43200').should('exist');
        cy.get('button#86400').should('exist');
        cy.get('button#604800').should('exist');
      } else {
        cy.get('button#43200').should('not.exist');
        cy.get('button#86400').should('not.exist');
        cy.get('button#604800').should('not.exist');
      }
    });
  });
});

Then('user does not see graph duration menu', () => {
  cy.get('button#time_range_duration-toggle').invoke('attr', 'aria-expanded').should('eq', 'false');
});

Then('user sees selected graph duration {string}', (duration: string) => {
  cy.get('button#time_range_duration-toggle')
    .find('span[class="pf-v5-c-menu-toggle__text"]')
    .contains(duration)
    .should('exist');
});

Then('user sees graph refresh menu', () => {
  cy.get('button#time_range_refresh-toggle').invoke('attr', 'aria-expanded').should('eq', 'true');
  cy.get('div#time_range_refresh').within(() => {
    cy.get('button').should('have.length', 8);
    cy.get('button#0').should('exist');
    cy.get('button#1').should('exist');
    cy.get('button#10000').should('exist');
    cy.get('button#15000').should('exist');
    cy.get('button#30000').should('exist');
    cy.get('button#60000').should('exist');
    cy.get('button#300000').should('exist');
    cy.get('button#900000').should('exist');
  });
});

Then('user does not see graph refresh menu', () => {
  cy.get('button#time_range_refresh-toggle').invoke('attr', 'aria-expanded').should('eq', 'false');
});

Then('user sees selected graph refresh {string}', (refresh: string) => {
  cy.get('button#time_range_refresh-toggle')
    .find('span[class="pf-v5-c-menu-toggle__text"]')
    .contains(refresh)
    .should('exist');
});

Then('user sees a {string} graph', graphType => {
  cy.waitForReact();
  cy.getReact('GraphPageComponent', { state: { graphData: { isLoading: false }, isReady: true } })
    .should('have.length', '1')
    .then($graph => {
      const { state } = $graph[0];

      assert.equal(state.graphData.fetchParams.graphType, graphType);

      const controller = state.graphRefs.getController() as Visualization;
      assert.isTrue(controller.hasGraph());
      const { nodes } = elems(controller);

      assert.isAbove(nodes.length, 0);
    });
});
