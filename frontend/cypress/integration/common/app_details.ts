import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { getCellsForCol } from './table';
import { openTab } from './transition';
import { clickSpanFilterOptionWithFallback, clusterParameterExists } from './navigation';

const APP = 'details';
const NAMESPACE = 'bookinfo';
const WAYPOINT_FALLBACK = 'waypoint';

Then('user sees details information for the {string} app', (name: string) => {
  cy.getBySel('app-details-card').within(() => {
    cy.get('[data-test="details-cluster"]').contains('Cluster').should('be.visible');
    cy.get('[data-test="details-status"]').contains('Status').should('be.visible');
  });

  cy.getBySel('app-resources-card').within(() => {
    cy.get('#pfbadge-W').closest('li').contains(`${name}-v1`); // Workload
    cy.get('#pfbadge-S').closest('li').contains(name); // Service
  });

  cy.getBySel('app-resources-card').within(() => {
    clusterParameterExists(false);
  });
});

Then('user sees app Resources card', () => {
  cy.getBySel('app-resources-card').should('be.visible');
});

Then('user sees inbound and outbound traffic information', () => {
  openTab('Traffic');
  cy.contains('Inbound Traffic');

  // Details app should have some inbound traffic.
  cy.contains('No Inbound Traffic').should('not.exist');
  cy.contains('Outbound Traffic');
});

Then('user sees inbound metrics information', () => {
  cy.intercept(`**/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');

  openTab('Inbound Metrics');
  cy.wait('@fetchMetrics');

  // Charts render only when dashboard data is loaded. The metrics component does not forward
  // data-test to the DOM; with unmountOnExit only this tab's content is mounted.
  cy.get('[data-test="metrics-chart"]').should('have.length.greaterThan', 0);
});

Then('user sees outbound metrics information', () => {
  cy.intercept(`**/api/namespaces/${NAMESPACE}/apps/${APP}/dashboard*`).as('fetchMetrics');

  openTab('Outbound Metrics');
  cy.wait('@fetchMetrics');

  // Charts render only when dashboard data is loaded. The metrics component does not forward
  // data-test to the DOM; with unmountOnExit only this tab's content is mounted.
  cy.get('[data-test="metrics-chart"]').should('have.length.greaterThan', 0);
});

Then('user can filter spans by app {string}', (app: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', 'App').click();
  cy.get('input[placeholder="Filter by App"]').click();
  clickSpanFilterOptionWithFallback(app);

  getCellsForCol('App / Workload').each($cell => {
    const cellText = $cell.text().toLowerCase();
    const appMatches = cellText.includes(app.toLowerCase());
    const waypointMatches = cellText.includes(WAYPOINT_FALLBACK);
    expect(
      appMatches || waypointMatches,
      `Expected "${cellText}" to contain "${app}" or "${WAYPOINT_FALLBACK}"`
    ).to.equal(true);
  });

  getCellsForCol(4).first().click();

  // Check that kebab menu is opened
  cy.get('ul[role="menu"]').should('be.visible');
});

Then('user can filter spans by app {string} by {string}', (app: string, waypoint: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', 'App').click();
  cy.get('input[placeholder="Filter by App"]').click();

  clickSpanFilterOptionWithFallback(app, waypoint);

  getCellsForCol('App / Workload').each($cell => {
    const cellText = $cell.text().toLowerCase();
    const appMatches = cellText.includes(app.toLowerCase());
    const waypointMatches = cellText.includes(waypoint.toLowerCase());
    expect(appMatches || waypointMatches, `Expected "${cellText}" to contain "${app}" or "${waypoint}"`).to.equal(true);
  });

  getCellsForCol(4).first().click();

  // Check that kebab menu is opened
  cy.get('ul[role="menu"]').should('be.visible');
});

const typeToDetailsCardSelector = (type: string): string => {
  switch (type) {
    case 'workload':
      return '[data-test="workload-details-card"]';
    case 'service':
      return '[data-test="service-details-card"]';
    case 'app':
      return '[data-test="app-details-card"]';
    default:
      return `[data-test="${type}-details-card"]`;
  }
};

Then('no cluster badge for the {string} should be visible', (type: string) => {
  if (type === 'Istio config') {
    cy.get('#pfbadge-C').should('not.exist');
  } else if (type === 'graph side panel') {
    cy.get('#graph-side-panel').within(() => {
      cy.get('#pfbadge-C').should('not.exist');
    });
  } else {
    cy.get('#pfbadge-C').should('not.exist');
  }
});

Then('cluster badge for the {string} should be visible', (type: string) => {
  if (type === 'Istio config') {
    cy.get('#pfbadge-C').should('be.visible');
  } else if (type === 'graph side panel') {
    cy.get('#graph-side-panel').within(() => {
      cy.get('#pfbadge-C').should('be.visible');
    });
  } else {
    cy.get(typeToDetailsCardSelector(type)).within(() => {
      cy.contains('Cluster').should('be.visible');
    });
  }
});
