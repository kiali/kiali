import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { checkHealthIndicatorInTable, checkHealthStatusInTable, colExists } from './table';

const activateFilter = (state: string): void => {
  //decided to pause the refresh, because I'm intercepting the very same request that is used for the timed refresh
  cy.get('button#time_range_refresh-toggle').click();
  cy.get('button[id="0"]').click();
  cy.get('#loading_kiali_spinner').should('not.exist');

  cy.intercept({
    pathname: '**/api/clusters/workloads',
    query: {
      objects: ''
    }
  }).as('refresh');

  cy.get('button#filter_select_value-toggle').click();
  cy.contains('div#filter_select_value button', state).click();
};

Given('a healthy workload in the cluster', function () {
  this.targetNamespace = 'bookinfo';
  this.targetWorkload = 'productpage-v1';
});

//When you use this, you need to annotate test by @sleep-app-scaleup-after to revert this change after the test
Given('an idle sleep workload in the cluster', function () {
  this.targetNamespace = 'sleep';
  this.targetWorkload = 'sleep';

  cy.exec('kubectl scale -n sleep --replicas=0 deployment/sleep');
});

Given('a failing workload in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetWorkload = 'v-server';
});

Given('a degraded workload in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetWorkload = 'b-client';
});

When('user filters for workload type {string}', (workloadType: string) => {
  cy.get('div#filter_select_value-toggle').find('button').click();
  cy.contains('div#filter_select_value button', workloadType).click();
});

Then('user sees {string} in workloads table', (workload: string) => {
  cy.get('tbody').within(() => {
    if (workload === 'no workloads') {
      cy.contains('No workloads found');
    } else if (workload === 'workloads') {
      cy.contains('No workloads found').should('not.exist');
    } else {
      cy.contains('td', workload);
    }
  });
});

Then('user should only see healthy workloads in workloads table', () => {
  cy.get('tbody').within(() => {
    cy.get('span[class*="icon-healthy"]').should('be.visible');
    cy.get('span[class*="icon-unhealthy"],span[class*="icon-degraded"],span[class*="icon-na"]').should('not.exist');
  });
});

Then('user should only see workloads with the {string} label', (label: string) => {
  cy.wait('@refresh');
  cy.get('tbody').within(() => {
    const regex = new RegExp(`\\b${label}=`);

    cy.get('tr').each($item => {
      cy.wrap($item)
        .find('td')
        .eq(4)
        .within(() => {
          cy.get('span').children().contains(regex);
        });
    });
  });
});

Then('user should only see workloads with an app label', () => {
  cy.wait('@refresh');
  cy.get('tbody').within(() => {
    const regex = new RegExp(`app=|service\.istio\.io\/canonical-name=|app\.kubernetes\.io\/name=`);

    cy.get('tr').each($item => {
      cy.wrap($item)
        .find('td')
        .eq(4)
        .within(() => {
          cy.get('span').children().contains(regex);
        });
    });
  });
});

Then('user should only see workloads with a version label', () => {
  cy.wait('@refresh');
  cy.get('tbody').within(() => {
    const regex = new RegExp(`version=|service\.istio\.io\/canonical-revision=|app\.kubernetes\.io\/version=`);

    cy.get('tr').each($item => {
      cy.wrap($item)
        .find('td')
        .eq(4)
        .within(() => {
          cy.get('span').children().contains(regex);
        });
    });
  });
});

When('user filters for version {string}', (state: string) => {
  activateFilter(state);
});

When('user filters for app label {string}', (state: string) => {
  activateFilter(state);
});

Then('the workload should be listed as {string}', function (healthStatus: string) {
  checkHealthIndicatorInTable(this.targetNamespace, 'Deployment', this.targetWorkload, healthStatus);
});

Then('the health status of the workload should be {string}', function (healthStatus: string) {
  checkHealthStatusInTable(this.targetNamespace, 'Deployment', this.targetWorkload, healthStatus);
});

Then('user sees all the Workloads toggles', () => {
  cy.get('[data-test="toggle-health"]').should('be.checked');
  cy.get('[data-test="toggle-istioResources"]').should('be.checked');

  colExists('Health', true);
  colExists('Details', true);
});
