import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { openTab } from './transition';
import { getCellsForCol } from './table';
import { Pod } from 'types/IstioObjects';

// waitForWorkloadEnrolled waits until Kiali returns the namespace labels updated
// Adding the waypoint label into the bookinfo namespace
// This is usually enough (Slower) to have the workloads enrolled
const waitForWorkloadEnrolled = (maxRetries = 30, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(`Condition not met after ${maxRetries} retries`);
  }

  cy.request({ method: 'GET', url: '/api/namespaces' }).then(response => {
    expect(response.status).to.equal(200);

    const ns = response.body;
    let found = false;

    ns.forEach(namespace => {
      if (namespace.name === 'bookinfo') {
        const labels = namespace.labels;
        Object.keys(labels).forEach(key => {
          if (labels[key] === 'waypoint') {
            found = true;
            return;
          }
        });
      }
    });

    if (found) {
      return;
    } else {
      return cy.wait(10000).then(() => {
        return waitForWorkloadEnrolled(maxRetries, retryCount + 1);
      });
    }
  });
};

const waitForBookinfoWaypointTrafficGeneratedInGraph = (maxRetries = 30, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(`Condition not met after ${maxRetries} retries`);
  }

  cy.request({
    method: 'GET',
    url:
      '/api/namespaces/graph?duration=60s&graphType=versionedApp&includeIdleEdges=false&injectServiceNodes=true&boxBy=cluster,namespace,app&waypoints=false&ambientTraffic=waypoint&appenders=deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient&rateGrpc=requests&rateHttp=requests&rateTcp=sent&namespaces=bookinfo'
  }).then(response => {
    expect(response.status).to.equal(200);
    const elements = response.body.elements;

    if (elements?.edges?.length > 10) {
      return;
    } else {
      return cy.wait(10000).then(() => {
        return waitForBookinfoWaypointTrafficGeneratedInGraph(maxRetries, retryCount + 1);
      });
    }
  });
};

const isSyncedOrIgnored = (status: string | undefined): boolean => {
  return status?.toLowerCase() === 'synced' || status?.toLowerCase() === 'ignored';
};

const proxyStatusHealthy = ({ proxyStatus }: Pod): boolean => {
  return (
    isSyncedOrIgnored(proxyStatus?.CDS) &&
    isSyncedOrIgnored(proxyStatus?.EDS) &&
    isSyncedOrIgnored(proxyStatus?.LDS) &&
    isSyncedOrIgnored(proxyStatus?.RDS)
  );
};

const waitForHealthyWaypoint = (name: string, namespace: string, cluster?: string): void => {
  const maxRetries = 30;
  let url = `/api/namespaces/${namespace}/workloads/${name}?validate=true&rateInterval=60s&health=true`;
  if (cluster) {
    url += `&cluster=${cluster}`;
  }

  const wait = (retryCount: number): void => {
    if (retryCount >= maxRetries) {
      throw new Error(`Condition not met after ${maxRetries} retries`);
    }
    cy.request({
      method: 'GET',
      url: url
    }).then(response => {
      expect(response.status).to.equal(200);
      const workload = response.body;

      if (workload.pods.length > 0 && workload.pods.every(pod => proxyStatusHealthy(pod))) {
        return;
      }

      return cy.wait(10000).then(() => {
        return wait(retryCount + 1);
      });
    });
  };
  wait(0);
};

Then('all waypoints are healthy', () => {
  cy.exec(
    `kubectl get deployments -A -l gateway.istio.io/managed=istio.io-mesh-controller -o jsonpath='{range .items[*]}{.metadata.name}/{.metadata.namespace} {end}'`
  ).then(response => {
    const waypoints = response.stdout.split(' ');
    waypoints.forEach(waypoint => {
      const [name, namespace] = waypoint.split('/');
      waitForHealthyWaypoint(name, namespace, '');
    });
  });
});

Then('{string} namespace is labeled with the waypoint label', (namespace: string) => {
  cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint`, { failOnNonZeroExit: false });
  waitForWorkloadEnrolled();
});

Then('the graph page has enough data', () => {
  waitForBookinfoWaypointTrafficGeneratedInGraph();
});

Then('the user hovers in the {string} label and sees {string} in the tooltip', (label: string, text: string) => {
  cy.get(`[data-test=workload-description-card]`).contains('span', label).trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', text);
  cy.get(`[data-test=workload-description-card]`).contains('span', label).trigger('mouseleave');
});

Then("the user doesn't see a L7 link", () => {
  cy.get('[data-test=workload-description-card]').should('not.contain', 'L7');
});

Then('the user sees the L7 {string} link', (waypoint: string) => {
  cy.get('[data-test=workload-description-card]').should('contain', 'L7');
  cy.get(`[data-test=waypoint-list]`).contains('span', 'L7');
  cy.get(`[data-test=waypoint-link]`).contains('a', waypoint);
});

Then('the link for the waypoint {string} should redirect to a valid workload details', (waypoint: string) => {
  cy.get(`[data-test=waypoint-link]`).contains('a', waypoint).click({ force: true });
  cy.get(`[data-test=workload-description-card]`).contains('h5', waypoint);
});

Then('the user sees the {string} option in the pod tooltip, and is {string}', (option: string, value: string) => {
  cy.get(`[data-test=pod-info]`).trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', option);
  cy.get('[role="tooltip"]').should('be.visible').and('contain', value);
  cy.get(`[data-test=pod-info]`).trigger('mouseleave');
});

Then('the user sees the {string} badge', (name: string) => {
  cy.get(`#pfbadge-${name}`).should('exist').contains(name);
});

Then('the proxy status is {string}', (status: string) => {
  cy.get('[data-label=Status]').get(`.icon-${status}`).should('exist');
});

Then(
  'the waypoint {string} in namespace {string} in cluster {string} is healthy',
  (name: string, namespace: string, cluster: string) => {
    waitForHealthyWaypoint(name, namespace, cluster);
  }
);

// Action skipped in ossmc
Then('the user can see the {string} istio config and badge {string}', (config: string, badge: string) => {
  cy.url().then(currentURL => {
    // The istio configs for OpenShift are not the same
    if (!currentURL?.includes('ossmconsole')) {
      cy.get('#IstioConfigCard').should('be.visible').get(`[data-test="${config}"]`).should('exist');
      cy.get('#IstioConfigCard').should('be.visible').get(`#${badge}`).should('exist');
    }
  });
});

Then('the proxy status is {string} with {string} details', (status: string, detail: string) => {
  cy.get('[test-data=proxy-status]').get(`.icon-${status}`).should('exist');
  cy.get('[test-data=proxy-status]').trigger('mouseenter');
  cy.get('[role="tooltip"]').should('be.visible').and('contain', detail);
  cy.get(`[data-test=pod-info]`).trigger('mouseleave');
});

Then('the user goes to the {string} tab', (tab: string) => {
  openTab(tab);
});

Then('user goes to the waypoint {string} subtab', (subtab: string) => {
  cy.get('#waypoint-details').should('be.visible').contains(subtab).click();
});

Then("the {string} subtab doesn't exist", (subtab: string) => {
  cy.get('#waypoint-details').should('be.visible').should('not.contain', subtab);
});

Then('validates Services data', () => {
  cy.get('[data-test="enrolled-data-title"]').should('be.visible');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Name"]').and('contain', 'productpage');
  cy.get('[role="grid"]').should('be.visible').get('#pfbadge-S').should('exist');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Namespace"]').and('contain', 'bookinfo');
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Labeled by"]').and('contain', 'namespace');
});

Then(
  'validates Services data with {string} rows and {string} workload, {string} namespace, {string} label for, {string} badge',
  (rows: number, workload: string, ns: string, label: string, badge: string) => {
    cy.get('[data-test="enrolled-data-title"]').should('be.visible');
    cy.get('table tbody tr').should('have.length', rows);
    cy.get('[role="grid"]').should('be.visible').get('[data-label="Name"]').and('contain', workload);
    cy.get('[role="grid"]').should('be.visible').get(`#${badge}`).should('exist');
    cy.get('[role="grid"]').should('be.visible').get('[data-label="Namespace"]').and('contain', ns);
    cy.get('[role="grid"]').should('be.visible').get('[data-label="Labeled by"]').and('contain', label);
  }
);

Then('validates waypoint Info data for {string}', (type: string) => {
  cy.get('[data-test=waypointfor-title]').should('exist').and('contain', type);
  cy.get('[role="grid"]').should('be.visible').get('[data-label=RDS]').and('contain', 'IGNORED');
});

When('the user validates the Ztunnel tab for the {string} namespace', (namespace: string) => {
  openTab('Ztunnel');
  cy.get('#ztunnel-details').should('be.visible').contains('Services').click();
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Service VIP"]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Waypoint]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Namespace]').and('contain', 'bookinfo');
  cy.get('#ztunnel-details').should('be.visible').contains('Workloads').click();
  cy.get('[role="grid"]').should('be.visible').get('[data-label="Pod Name"]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Node]');
  cy.get('[role="grid"]').should('be.visible').get('[data-label=Namespace]').and('contain', 'bookinfo');
  // Validate filters in the Namespace column
  cy.get('button#filter_select_type-toggle').click();
  cy.contains('div#filter_select_type button', 'Namespace').click();
  cy.get('input[placeholder="Filter by Namespace"]').type(`${namespace}{enter}`);
  cy.get(`li[label="${namespace}"]`).should('be.visible').find('button').click();

  getCellsForCol('Namespace').each($cell => {
    cy.wrap($cell).contains(namespace);
  });
});

Then('the user updates the log level to {string}', (level: string) => {
  cy.get('[data-test=log-actions-dropdown]').should('exist').click();
  cy.get(`#setLogLevel${level}`).should('exist').click();
});

When('user opens the menu', () => {
  cy.get('[aria-label="Actions"]').click();
});

When('the option {string} does not exist for {string} namespace', (option, namespace: string) => {
  let selector = '';
  if (option === 'Add to Ambient') {
    selector = `add-${namespace}-namespace-ambient`;
  }
  cy.get(selector).should('not.exist');
});

When('the user clicks on {string} for {string} namespace', (option, namespace: string) => {
  let selector = '';
  switch (option) {
    case 'removes auto injection':
      selector = `remove-${namespace}-namespace-sidecar-injection`;
      break;
    case 'Add to Ambient':
      selector = `add-${namespace}-namespace-ambient`;
      break;
    case 'remove Ambient':
      selector = `remove-${namespace}-namespace-ambient`;
      break;
    case 'enable sidecar':
      selector = `enable-${namespace}-namespace-sidecar-injection`;
      break;
  }
  cy.get(`[data-test=${selector}]`).click();
  cy.get(`[data-test="confirm-create"]`).click();
});

When('{string} badge {string}', (badge, option: string) => {
  let selector = 'not.exist';
  if (option === 'exist') {
    selector = 'exist';
  }
  let badgeSelector = 'control-plane-revision-badge';
  if (badge === 'Ambient') {
    badgeSelector = 'ambient-badge';
  }

  cy.get(`[data-test="${badgeSelector}"]`).should(selector);
});
