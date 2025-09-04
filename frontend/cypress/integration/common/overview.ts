import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';
import { getClusterForSingleCluster } from './table';

const CLUSTER1_CONTEXT = Cypress.env('CLUSTER1_CONTEXT');
const CLUSTER2_CONTEXT = Cypress.env('CLUSTER2_CONTEXT');

Given('a healthy application in the cluster', function () {
  this.targetNamespace = 'bookinfo';
  this.targetApp = 'productpage';
});

Given('a healthy application in the remote cluster', function () {
  this.targetNamespace = 'bookinfo';
  this.targetApp = 'ratings';
});

//When you use this, you need to annotate test by @sleep-app-scaleup-after to revert this change after the test
Given('an idle sleep application in the cluster', function () {
  this.targetNamespace = 'sleep';
  this.targetApp = 'sleep';

  cy.exec('kubectl scale -n sleep --replicas=0 deployment/sleep');
});

Given('an idle application in the remote cluster', function () {
  this.targetNamespace = 'bookinfo';
  this.targetApp = 'reviews';
});

Given('a failing application in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetApp = 'v-server';
});

Given('a degraded application in the mesh', function () {
  this.targetNamespace = 'alpha';
  this.targetApp = 'b-client';
});

When('user clicks in the {string} view', (view: string) => {
  cy.get(`button[data-test="overview-type-${view}"]`)
    .click()
    // Using the #loading_kiali_spinner selector we can control when the UI is still loading some data
    // That may prevent that the test progress in cases where we need more control.
    .get('#loading_kiali_spinner')
    .should('not.exist');
});

When(`user filters {string} namespace`, (ns: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', 'Namespace').click();

  cy.get('input#filter_input_value').type(ns).type('{enter}');
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`user filters {string} health`, (health: string) => {
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', 'Health').click();

  cy.get('button#filter_select_value-toggle').click();
  cy.contains('div#filter_select_value button', health).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`user selects Health for {string}`, (type: string) => {
  cy.get('button#overview-type-toggle').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.contains('div#overview-type button', type).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`user sorts by name desc`, () => {
  cy.get('button[data-sort-asc="true"]').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`user sorts by column {string} desc`, (column: string) => {
  cy.get(`th[data-label=${column}]`).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`the list is sorted by {string} desc`, (column: string) => {
  // This checks that every row is sorted by checking the column text and
  // comparing it with the next row.
  cy.get('tbody').within(() => {
    cy.get('tr').then($rows => {
      $rows.each((index, $row) => {
        if (index < $rows.length - 1) {
          const currentRow = $row.querySelector(`td[data-label="${column}"]`)?.textContent;
          const nextRow = $rows[index + 1].querySelector(`td[data-label="${column}"]`)?.textContent;
          expect(currentRow?.localeCompare(nextRow ?? '')).to.be.at.most(0);
        }
      });
    });
  });
});

When(`user selects {string} time range`, (interval: string) => {
  cy.get('button#time_range_duration-toggle').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.contains('div#time_range_duration button', interval).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When(`user selects {string} traffic direction`, (direction: string) => {
  cy.get('button#direction-type-toggle').click();
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.contains('div#direction-type button', direction).click();
  cy.get('#loading_kiali_spinner').should('not.exist');
});

When('I fetch the overview of the cluster', () => {
  cy.visit({ url: '/console/overview?refresh=0' });
});

Then(`user sees the {string} namespace card`, (ns: string) => {
  cy.get(`div[data-test^="${ns}"]`);
});

Then(`user sees the {string} namespace card in cluster {string}`, (ns: string, cluster: string) => {
  // TODO: Incorporate cluster into existing namespace checks with cluster+ns as data-test-id.
  cy.get(`div[data-test^="${ns}"]`).contains(cluster).should('exist').and('length', 1);
  cy.get(`[data-test="CardItem_${ns}_${cluster}"]`);
});

Then(`user does not see the {string} namespace card in any cluster`, ns => {
  cy.get(`div[data-test^="${ns}"]`).should('not.exist');
});

Then(`user does not see the {string} namespace card in cluster {string}`, (ns, cluster) => {
  cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).should('not.exist');
});

Then(`user sees a {string} {string} namespace`, (view, ns: string) => {
  if (view === 'LIST') {
    cy.get('td[role="gridcell"]').contains(ns);
  } else {
    cy.get(`div[data-test="${ns}-${view}"]`);
  }
});

Then(`user sees the {string} namespace with {string}`, (ns: string, type: string) => {
  let innerType = '';

  switch (type) {
    case 'Applications':
      innerType = 'app';
      break;
    case 'Workloads':
      innerType = 'workload';
      break;
    case 'Services':
      innerType = 'service';
      break;
  }

  cy.get(`div[data-test^="${ns}"]`).find(`[data-test="overview-type-${innerType}"]`);
});

Then(`user sees the {string} namespace list`, (nslist: string) => {
  const nss = nslist.split(',');

  cy.get('div[data-ouia-component-type="PF5/Card"]')
    .should('have.length', nss.length)
    .each(($a, i) => {
      expect($a.attr('data-test')).includes(nss[i]);
    });
});

Then(
  `user sees the {string} namespace with {string} traffic {string}`,
  (ns: string, direction: string, duration: string) => {
    cy.get(`div[data-test^="${ns}"]`).find(`div[data-test="sparkline-${direction}-duration-${duration}"]`);
  }
);

Then('there should be a {string} application indicator in the namespace', function (healthStatus: string) {
  cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health]`)
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .should('exist');
});

Then('there should be a {string} application indicator in the namespace in the {string} cluster', function (
  healthStatus: string,
  cluster: string
) {
  cy.get(`[data-test=CardItem_${this.targetNamespace}_${cluster}] [data-test=overview-app-health]`)
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .should('exist');
});

Then('the {string} application indicator should list the application', function (healthStatus: string) {
  let healthIndicatorStatusKey = healthStatus;

  if (healthStatus === 'idle') {
    healthIndicatorStatusKey = 'not-ready';
  }

  cy.get(`[data-test=${this.targetNamespace}-EXPAND] [data-test=overview-app-health]`)
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .trigger('mouseenter');

  cy.get(
    `[aria-label='Overview status'] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`
  )
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .should('exist');

  cy.get(
    `[aria-label='Overview status'] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`
  ).should('contain.text', this.targetApp);
});

Then('the {string} application indicator for the {string} cluster should list the application', function (
  healthStatus: string,
  cluster: string
) {
  let healthIndicatorStatusKey = healthStatus;

  if (healthStatus === 'idle') {
    healthIndicatorStatusKey = 'not-ready';
  }

  cy.get(`[data-test=CardItem_${this.targetNamespace}_${cluster}] [data-test=overview-app-health]`)
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .trigger('mouseenter');

  cy.get(
    `[aria-label='Overview status'] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`
  )
    .find('span')
    .filter(`.icon-${healthStatus}`)
    .should('exist');

  cy.get(
    `[aria-label='Overview status'] [data-test=${this.targetNamespace}-${healthIndicatorStatusKey}-${this.targetApp}]`
  ).should('contain.text', this.targetApp);
});

Then('the toggle on the right side of the {string} namespace card exists', (ns: string) => {
  ensureKialiFinishedLoading();
  cy.get(`div[data-test^="${ns}"]`).should('exist');
});

Then('user sees the {string} cluster badge in the Kiali header', (name: string) => {
  cy.get('[data-test="cluster-icon"]').contains(name).should('be.visible');
});

Then('user sees the {string} label in both {string} namespace cards', (label: string, ns: string) => {
  cy.get(`[data-test="CardItem_${ns}_east"]`).contains(label).should('be.visible');
  cy.get(`[data-test="CardItem_${ns}_west"]`).contains(label).should('be.visible');
});

Then('the toggle on the right side of both {string} namespace cards exists', (ns: string) => {
  ensureKialiFinishedLoading();

  cy.get(`[data-test="CardItem_${ns}_east"]`).find('[aria-label="Actions"]').should('exist');
  cy.get(`[data-test="CardItem_${ns}_west"]`).find('[aria-label="Actions"]').should('exist');
});

Then('Istio config should not be available for the {string} {string}', (cluster: string, ns: string) => {
  cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).contains('Istio config').siblings().contains('N/A');
});

Then('Istio config should be available for the {string} {string}', (cluster: string, ns: string) => {
  cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).contains('Istio config').siblings().should('not.contain', 'N/A');
});

Then(
  'health should be different for {string} and {string} {string}',
  (cluster1: string, cluster2: string, ns: string) => {
    if (ns === 'bookinfo') {
      cy.get(`[data-test="CardItem_${ns}_${cluster1}"]`).find('[data-test="overview-type-app"]').contains(`5 app`);
      cy.get(`[data-test="CardItem_${ns}_${cluster2}"]`).find('[data-test="overview-type-app"]').contains(`4 app`);
    } else if (ns === 'istio-system') {
      cy.get(`[data-test="CardItem_${ns}_${cluster1}"]`).find('[data-test="overview-type-app"]').contains(`7 app`);
      cy.get(`[data-test="CardItem_${ns}_${cluster2}"]`).find('[data-test="overview-type-app"]').contains(`4 app`);
    } else {
      cy.exec(
        `kubectl get pods -n ${ns} -l app --context ${CLUSTER1_CONTEXT} --no-headers | grep Running | wc -l`
      ).then(r1 => {
        let appPods = parseInt(r1.stdout);
        cy.exec(
          `kubectl get pods -n ${ns} -l 'app.kubernetes.io/name,!app' --context ${CLUSTER1_CONTEXT} --no-headers | grep Running | wc -l`
        ).then(r2 => {
          appPods += parseInt(r2.stdout);
          cy.exec(
            `kubectl get pods -n ${ns} -l 'service.istio.io/canonical-name,!app.kubernetes.io/name,!app' --context ${CLUSTER1_CONTEXT} --no-headers | grep Running | wc -l`
          ).then(r3 => {
            appPods += parseInt(r3.stdout);
            cy.get(`[data-test="CardItem_${ns}_${cluster1}"]`)
              .find('[data-test="overview-type-app"]')
              .contains(`${appPods} app`);
          });
        });
      });

      cy.exec(
        `kubectl get pods -n ${ns} -l app --context ${CLUSTER2_CONTEXT} --no-headers | grep Running | wc -l`
      ).then(r1 => {
        let appPods = parseInt(r1.stdout);
        cy.exec(
          `kubectl get pods -n ${ns} -l 'app.kubernetes.io/name,!app' --context ${CLUSTER2_CONTEXT} --no-headers | grep Running | wc -l`
        ).then(r2 => {
          appPods += parseInt(r2.stdout);
          cy.exec(
            `kubectl get pods -n ${ns} -l 'service.istio.io/canonical-name,!app.kubernetes.io/name,!app' --context ${CLUSTER2_CONTEXT} --no-headers | grep Running | wc -l`
          ).then(r3 => {
            appPods += parseInt(r3.stdout);
            cy.get(`[data-test="CardItem_${ns}_${cluster2}"]`)
              .find('[data-test="overview-type-app"]')
              .contains(`${appPods} app`);
          });
        });
      });
    }
  }
);

Then('user sees the {string} label in the {string} namespace card', (label: string, ns: string) => {
  cy.log(label);

  cy.get(`div[data-test^="${ns}"]`).contains(label).should('be.visible');
});

Then('user does not see any cluster badge in the {string} namespace card', (ns: string) => {
  cy.get(`[data-test="${ns}-EXPAND"]`).within($card => {
    cy.get('#pfbadge-C').should('not.exist');
  });
});

Then(
  'user sees the {string} label in the {string} {string} namespace card',
  (label: string, cluster: string, ns: string) => {
    cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).contains(label).should('be.visible');
  }
);

Then(
  'user does not see the {string} label in the {string} {string} namespace card',
  (label: string, cluster: string, ns: string) => {
    cy.get(`[data-test="CardItem_${ns}_${cluster}"]`).contains(label).should('not.exist');
  }
);

Then(
  'cluster badges for {string} and {string} cluster are visible in the LIST view',
  (cluster1: string, cluster2: string) => {
    cy.getBySel(`VirtualItem_Cluster${cluster1}_bookinfo`).contains(cluster1).should('be.visible');
    cy.getBySel(`VirtualItem_Cluster${cluster2}_bookinfo`).contains(cluster2).should('be.visible');
  }
);

Then('Control Plane metrics should be visible for cluster {string}', (cluster: string) => {
  cy.getBySel(`VirtualItem_Cluster${cluster}_istio-system`).find('[data-test="cpu-chart"]');
  cy.getBySel(`VirtualItem_Cluster${cluster}_istio-system`).find('[data-test="memory-chart"]');
});

Then('badge for {string} is visible in the LIST view in the namespace {string}', (label: string, ns: string) => {
  getClusterForSingleCluster().then(cluster => {
    cy.getBySel(`VirtualItem_Cluster${cluster}_${ns}`).contains(label).should('be.visible');
  });
});
