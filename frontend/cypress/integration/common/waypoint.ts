import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading, openTab } from './transition';
import { getCellsForCol } from './table';
import { Pod } from 'types/IstioObjects';

// waitForWorkloadEnrolled waits until Kiali returns the namespace labels updated
// Adding the waypoint label into the bookinfo namespace
// This is usually enough (Slower) to have the workloads enrolled
const waitForWorkloadEnrolled = (targetNamespace: string, maxRetries = 30, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(
      `Condition not met after ${maxRetries} retries (waitForWorkloadEnrolled, baseUrl=${Cypress.config('baseUrl')})`
    );
  }

  cy.request({ method: 'GET', url: `${Cypress.config('baseUrl')}/api/namespaces` }).then(response => {
    expect(response.status).to.equal(200);

    const ns = response.body;
    let found = false;
    let bookinfoLabels: Record<string, string> | undefined;

    ns.forEach(namespace => {
      if (namespace.name === targetNamespace) {
        const labels = namespace.labels;
        bookinfoLabels = labels;
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
      // Debug breadcrumbs for CI failures (shows in Cypress command log).
      if (retryCount === 0 || retryCount % 5 === 0) {
        Cypress.log({
          name: 'waitForWorkloadEnrolled',
          message: `retry=${retryCount}/${maxRetries} url=${Cypress.config(
            'baseUrl'
          )}/api/namespaces baseUrl=${Cypress.config('baseUrl')} bookinfoLabels=${JSON.stringify(
            bookinfoLabels ?? {}
          )} namespacesCount=${Array.isArray(ns) ? ns.length : -1} targetNamespace=${targetNamespace}`
        });
      }
      return cy.wait(10000).then(() => {
        return waitForWorkloadEnrolled(targetNamespace, maxRetries, retryCount + 1);
      });
    }
  });
};

const waitForBookinfoWaypointTrafficGeneratedInGraph = (
  targetNamespace: string,
  ambientTraffic: string,
  maxRetries = 30,
  retryCount = 0
): void => {
  if (retryCount >= maxRetries) {
    throw new Error(
      `Condition not met after ${maxRetries} retries (waitForBookinfoWaypointTrafficGeneratedInGraph, ambientTraffic=${ambientTraffic}, baseUrl=${Cypress.config(
        'baseUrl'
      )})`
    );
  }

  let totalEdges = 9;
  if (ambientTraffic === 'waypoint') {
    totalEdges = 8;
  }

  cy.request({
    method: 'GET',
    url: `${Cypress.config('baseUrl')}/api/namespaces/graph`,
    qs: {
      duration: '60s',
      graphType: 'versionedApp',
      includeIdleEdges: false,
      injectServiceNodes: true,
      boxBy: 'cluster,namespace,app',
      waypoints: false,
      ambientTraffic: ambientTraffic,
      appenders: 'deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient',
      rateGrpc: 'requests',
      rateHttp: 'requests',
      rateTcp: 'sent',
      namespaces: targetNamespace
    }
  }).then(response => {
    expect(response.status).to.equal(200);
    const elements = response.body.elements;

    if (elements?.edges?.length > totalEdges) {
      return;
    } else {
      if (retryCount === 0 || retryCount % 5 === 0) {
        Cypress.log({
          name: 'waitForGraphTraffic',
          message: `retry=${retryCount}/${maxRetries} url=${Cypress.config(
            'baseUrl'
          )}/api/namespaces/graph ambientTraffic=${ambientTraffic} edges=${
            elements?.edges?.length ?? -1
          } expected>${totalEdges} baseUrl=${Cypress.config('baseUrl')} targetNamespace=${targetNamespace}`
        });
      }
      return cy.wait(10000).then(() => {
        return waitForBookinfoWaypointTrafficGeneratedInGraph(
          targetNamespace,
          ambientTraffic,
          maxRetries,
          retryCount + 1
        );
      });
    }
  });
};

const isSyncedOrIgnored = (status: string | undefined): boolean => {
  return status?.toLowerCase() === 'synced' || status?.toLowerCase() === 'ignored';
};

// In some ambient setups, waypoints can report CDS as "Stale" transiently (or even persistently)
// while still being usable. We keep EDS/LDS/RDS strict but allow CDS to be Stale.
const isSyncedOrIgnoredOrStale = (status: string | undefined): boolean => {
  const s = status?.toLowerCase();
  return s === 'synced' || s === 'ignored' || s === 'stale';
};

const proxyStatusHealthy = ({ proxyStatus }: Pod): boolean => {
  return (
    isSyncedOrIgnoredOrStale(proxyStatus?.CDS) && // Stale for Multi cluster (Istio 1.28)
    isSyncedOrIgnored(proxyStatus?.EDS) &&
    isSyncedOrIgnored(proxyStatus?.LDS) &&
    isSyncedOrIgnored(proxyStatus?.RDS)
  );
};

const waitForWorkloadTracesInApi = (
  namespace: string,
  workload: string,
  clusterName?: string,
  maxRetries = 18,
  retryCount = 0
): void => {
  if (retryCount >= maxRetries) {
    throw new Error(
      `Waypoint traces not found after ${maxRetries} retries (namespace=${namespace}, workload=${workload} cluster=${
        clusterName ?? ''
      }, baseUrl=${Cypress.config('baseUrl')})`
    );
  }

  const nowMicros = Date.now() * 1000;
  const qs: Record<string, any> = {
    // last 10 minutes (micros)
    startMicros: nowMicros - 10 * 60 * 1000 * 1000,
    endMicros: nowMicros,
    tags: '{}',
    limit: 100
  };
  if (clusterName) {
    qs.clusterName = clusterName;
  }

  cy.request({
    method: 'GET',
    url: `${Cypress.config('baseUrl')}/api/namespaces/${namespace}/workloads/${workload}/traces`,
    qs,
    failOnStatusCode: false
  }).then(response => {
    expect(response.status).to.equal(200);
    const traces = response.body?.data;
    if (Array.isArray(traces) && traces.length > 0) {
      return;
    }

    if (retryCount === 0 || retryCount % 5 === 0) {
      Cypress.log({
        name: 'waitForWorkloadTraces',
        message: `retry=${retryCount}/${maxRetries} url=${Cypress.config(
          'baseUrl'
        )}/api/namespaces/${namespace}/workloads/${workload}/traces clusterName=${clusterName ?? ''} tracesCount=${
          Array.isArray(traces) ? traces.length : -1
        } baseUrl=${Cypress.config('baseUrl')}`
      });
    }

    return cy
      .wait(10000)
      .then(() => waitForWorkloadTracesInApi(namespace, workload, clusterName, maxRetries, retryCount + 1));
  });
};

const waitForHealthyWaypoint = (name: string, namespace: string, cluster?: string): void => {
  const maxRetries = 20;
  let requestUrl = `${Cypress.config(
    'baseUrl'
  )}/api/namespaces/${namespace}/workloads/${name}?validate=true&rateInterval=60s&health=true`;
  if (cluster) {
    requestUrl += `&clusterName=${cluster}`;
  }

  const wait = (retryCount: number, lastResponseSummary = ''): void => {
    if (retryCount >= maxRetries) {
      throw new Error(
        `Condition not met after ${maxRetries} retries (waitForHealthyWaypoint name=${name} ns=${namespace} cluster=${
          cluster ?? ''
        }, baseUrl=${Cypress.config('baseUrl')}, url=${requestUrl}, lastResponse=${lastResponseSummary})`
      );
    }
    cy.request({
      method: 'GET',
      url: requestUrl,
      failOnStatusCode: false
    }).then(response => {
      const responseBody = response.body;
      const responseBodyStr =
        responseBody === undefined
          ? 'undefined'
          : typeof responseBody === 'string'
          ? responseBody
          : JSON.stringify(responseBody);
      const responseBodyShort = responseBodyStr.length > 800 ? `${responseBodyStr.slice(0, 800)}...` : responseBodyStr;

      const workload = responseBody;
      const pods = Array.isArray(workload?.pods) ? workload.pods : [];
      const podsLen = pods.length;
      const proxySummary =
        podsLen > 0
          ? pods
              .slice(0, 3)
              .map(p => {
                const ps = p?.proxyStatus ?? {};
                return `${p?.name ?? 'pod'}(CDS=${ps.CDS ?? ''},EDS=${ps.EDS ?? ''},LDS=${ps.LDS ?? ''},RDS=${
                  ps.RDS ?? ''
                })`;
              })
              .join(',')
          : 'no-pods';

      const responseSummary = `status=${response.status} fullUrl=${requestUrl} pods=${podsLen} proxy=${proxySummary} body=${responseBodyShort}`;

      if (response.status !== 200) {
        if (retryCount === 0 || retryCount % 5 === 0) {
          Cypress.log({
            name: 'waitForHealthyWaypoint',
            message: `retry=${retryCount}/${maxRetries} ${responseSummary}`
          });
        }
        return cy.wait(30000).then(() => wait(retryCount + 1, responseSummary));
      }

      if (podsLen > 0 && pods.every(pod => proxyStatusHealthy(pod))) {
        return;
      }

      if (retryCount === 0 || retryCount % 5 === 0) {
        Cypress.log({
          name: 'waitForHealthyWaypoint',
          message: `retry=${retryCount}/${maxRetries} ${responseSummary}`
        });
      }

      return cy.wait(10000).then(() => {
        return wait(retryCount + 1, responseSummary);
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

const waitForWaypointTracesInApi = (
  namespace: string,
  workload: string,
  clusterName?: string,
  maxRetries = 10,
  retryCount = 0
): void => {
  if (retryCount >= maxRetries) {
    throw new Error(
      `Waypoint traces not found after ${maxRetries} retries (namespace=${namespace}, cluster=${clusterName ?? ''})`
    );
  }

  const nowMicros = Date.now() * 1000;
  const qs: Record<string, any> = {
    // last 10 minutes (micros)
    startMicros: nowMicros - 10 * 60 * 1000 * 1000,
    endMicros: nowMicros,
    tags: '{}',
    limit: 100
  };
  if (clusterName) {
    qs.clusterName = clusterName;
  }

  cy.request({
    method: 'GET',
    url: `api/namespaces/${namespace}/workloads/${workload}/traces`,
    qs,
    failOnStatusCode: false
  }).then(response => {
    expect(response.status).to.equal(200);
    const traces = response.body?.data;
    if (Array.isArray(traces) && traces.length > 0) {
      return;
    }

    return cy
      .wait(10000)
      .then(() => waitForWaypointTracesInApi(namespace, workload, clusterName, maxRetries, retryCount + 1));
  });
};

Then('the waypoint tracing data is ready', () => {
  waitForWaypointTracesInApi('bookinfo', 'bookinfo-gateway-istio');
});

Then('{string} namespace is labeled with the waypoint label', (namespace: string) => {
  cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint`, { failOnNonZeroExit: false });
  waitForWorkloadEnrolled(namespace);
});

Then(
  '{string} namespace is labeled with the waypoint label for {string} and {string} contexts',
  (namespace: string, cluster1Context: string, cluster2Context: string) => {
    cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint --context="${cluster1Context}"`, {
      failOnNonZeroExit: false
    });
    cy.exec(`kubectl label namespace ${namespace} istio.io/use-waypoint=waypoint --context="${cluster2Context}"`, {
      failOnNonZeroExit: false
    });
    waitForWorkloadEnrolled(namespace);
  }
);

Then('the graph page has enough data', () => {
  waitForBookinfoWaypointTrafficGeneratedInGraph('bookinfo', 'ztunnel');
});

Then('the graph page has enough data for L7', () => {
  waitForBookinfoWaypointTrafficGeneratedInGraph('bookinfo', 'waypoint');
});

Then('the graph page has enough data for L7 in the {string} namespace', (namespace: string) => {
  waitForBookinfoWaypointTrafficGeneratedInGraph(namespace, 'waypoint');
});

Then('the {string} tracing data is ready in the {string} namespace', (workload: string, namespace: string) => {
  // Poll the traces endpoint so downstream assertions on tracing UI don't flake.
  waitForWorkloadTracesInApi(namespace, workload);
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

Then('the waypoint link points to the {string} cluster', (cluster: string) => {
  cy.get(`[data-test=waypoint-link]`).should('exist');

  cy.get(`[data-test=waypoint-link]`).then($waypointLink => {
    // Depending on the component, the data-test might be set on the <a> itself
    // or on a container that contains the <a>.
    const $anchor = $waypointLink.filter('a').add($waypointLink.find('a')).first();

    expect($anchor.length, 'waypoint link anchor').to.be.greaterThan(0);

    const href = $anchor.attr('href') ?? '';
    expect(href).to.include(`clusterName=${cluster}`);
  });
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

When('user opens the menu for the {string} namespace', (namespace: string) => {
  cy.get('tbody').contains('tr', namespace).find('button[aria-label="Actions"]').should('be.visible').click();
});

When('the option {string} does not exist for {string} namespace', (option, namespace: string) => {
  let selector = '';
  if (option === 'Add to Ambient') {
    selector = `add-${namespace}-namespace-ambient`;
  }
  cy.get(`[data-test="${selector}"]`).should('not.exist');
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
  // Click the menu item button (the button inside the li element)
  cy.get(`[data-test=${selector}]`).find('button').click();
  // Click outside the menu to close it before interacting with the modal
  cy.get('body').click(0, 0);
  // Wait for the modal to appear - check for modal content to ensure it's fully rendered
  cy.contains('Are you sure?', { timeout: 10000 }).should('be.visible');
  // Wait for modal confirm button to be visible and clickable
  cy.get(`[data-test="confirm-create"]`).should('be.visible').should('not.be.disabled').click();
  ensureKialiFinishedLoading();
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
