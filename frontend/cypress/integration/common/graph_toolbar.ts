import { Before, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { CytoscapeGlobalScratchData, CytoscapeGlobalScratchNamespace } from '../../../src/types/Graph';

const url = '/console';

Before(() => {
  // Copied from overview.ts.  This prevents cypress from stopping on errors unrelated to the tests.
  // There can be random failures due timeouts/loadtime/framework that throw browser errors.  This
  // prevents a CI failure due something like a "slow".  There may be a better way to handle this.
  cy.on('uncaught:exception', (err, runnable, promise) => {
    // when the exception originated from an unhandled promise
    // rejection, the promise is provided as a third argument
    // you can turn off failing the test in this case
    if (promise) {
      return false;
    }
    // we still want to ensure there are no other unexpected
    // errors, so we let them fail the test
  });
});

When('user graphs {string} namespaces with refresh {string} and duration {string}', (namespaces, refresh, duration) => {
  cy.visit(url + `/graph/namespaces?refresh=${refresh}&duration=${duration}&namespaces=${namespaces}`);
});

When('user clicks graph tour', () => {
  cy.get('button#graph-tour').click();
});

When('user closes graph tour', () => {
  cy.get('div[role="dialog"]').find('button[aria-label="Close"]').click();
});

When('user clicks graph traffic menu', () => {
  cy.get('button#graph-traffic-dropdown').click();
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

When('user enables {string} traffic', protocol => {
  cy.get('div#graph-traffic-menu').find(`input#${protocol}`).should('exist').check();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user clicks graph duration menu', () => {
  cy.get('button[aria-labelledby^="time_range_duration"]').click();
});

When(`user selects graph duration {string}`, duration => {
  cy.get('button[aria-labelledby^="time_range_duration"]').click();
  cy.get(`li#${duration}`).children('button').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('user clicks graph refresh menu', () => {
  cy.get('button[aria-labelledby^="time_range_refresh"]').click();
});

When(`user selects graph refresh {string}`, refresh => {
  cy.get('button[aria-labelledby^="time_range_refresh"]').click();
  cy.get(`li[id="${refresh}"]`).children('button').click().get('#loading_kiali_spinner').should('not.exist');
});

When('user selects {string} graph type', graphType => {
  cy.get('button#graph_type_dropdown-toggle')
    .click()
    .parent()
    .find('ul#graph_type_dropdown')
    .find(`li#${graphType}`)
    .click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});
Then('user {string} graph tour', action => {
  if (action === 'sees') {
    cy.get('div[role="dialog"]').find('span').contains('Shortcuts').should('exist');
  } else {
    cy.get('div[role="dialog"]').should('not.exist');
  }
});

Then('user sees default graph traffic menu', () => {
  cy.get('button#graph-traffic-dropdown').invoke('attr', 'aria-expanded').should('eq', 'true');
  cy.get('div#graph-traffic-menu').within(() => {
    cy.get('input').should('have.length', 11);
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

Then('user {string} {string} traffic', (action, protocol) => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const numEdges = state.cy.edges(`[protocol = "${protocol}"]`).length;
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
  cy.get('ul#time_range_duration').within(() => {
    cy.request('GET', '/api/config').then(response => {
      expect(response.status).to.equal(200);
      const scrapeInterval = response.body.prometheus.globalScrapeInterval;
      const retention = response.body.prometheus.storageTsdbRetention;
      expect(scrapeInterval).within(15, 60);
      expect(retention).gte(21600);

      cy.get('li').should('have.length.within', 7, 11);
      if (scrapeInterval < 60) {
        cy.get('li#60').should('exist');
      } else {
        cy.get('li#60').should('not.exist');
      }
      cy.get('li#120').should('exist');
      cy.get('li#300').should('exist');
      cy.get('li#600').should('exist');
      cy.get('li#1800').should('exist');
      cy.get('li#3600').should('exist');
      cy.get('li#10800').should('exist');
      cy.get('li#21600').should('exist');
      if (retention > 21600) {
        cy.get('li#43200').should('exist');
        cy.get('li#86400').should('exist');
        cy.get('li#604800').should('exist');
      } else {
        cy.get('li#43200').should('not.exist');
        cy.get('li#86400').should('not.exist');
        cy.get('li#604800').should('not.exist');
      }
    });
  });
});

Then('user does not see graph duration menu', () => {
  cy.get('button#time_range_duration-toggle').invoke('attr', 'aria-expanded').should('eq', 'false');
});

Then('user sees selected graph duration {string}', duration => {
  cy.get('button[aria-labelledby^="time_range_duration"]').find('span').contains(duration).should('exist');
});

Then('user sees graph refresh menu', refresh => {
  cy.get('button#time_range_refresh-toggle').invoke('attr', 'aria-expanded').should('eq', 'true');
  cy.get('ul#time_range_refresh').within(() => {
    cy.get('li').should('have.length', 7);
    cy.get('li#0').should('exist');
    cy.get('li#10000').should('exist');
    cy.get('li#15000').should('exist');
    cy.get('li#30000').should('exist');
    cy.get('li#60000').should('exist');
    cy.get('li#300000').should('exist');
    cy.get('li#900000').should('exist');
  });
});

Then('user does not see graph refresh menu', () => {
  cy.get('button#time_range_refresh-toggle').invoke('attr', 'aria-expanded').should('eq', 'false');
});

Then('user sees selected graph refresh {string}', refresh => {
  cy.get('button[aria-labelledby^="time_range_refresh"]').find('span').contains(refresh).should('exist');
});

Then('user sees a {string} graph', graphType => {
  cy.waitForReact();
  cy.getReact('CytoscapeGraph')
    .should('have.length', '1')
    .getCurrentState()
    .then(state => {
      const globalScratch: CytoscapeGlobalScratchData = state.cy.scratch(CytoscapeGlobalScratchNamespace);
      assert.equal(globalScratch.graphType, graphType);
    });
});
