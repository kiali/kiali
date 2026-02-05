import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

const CONTROL_PLANES_API_PATHNAME = '**/api/mesh/controlplanes';

const istioConfigsWithNoValidations = {
  permissions: {},
  resources: {
    'networking.istio.io/v1, Kind=Gateway': [
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw1', namespace: 'alpha' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw2', namespace: 'alpha' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw3', namespace: 'beta' } },
      { apiVersion: 'networking.istio.io/v1', kind: 'Gateway', metadata: { name: 'gw4', namespace: 'beta' } }
    ]
  },
  validations: {}
};

Given('Istio configs API returns at least 4 warning configs', () => {
  // The Overview Istio configs card calls /api/istio/config.
  // Returning configs without validations makes them show up as "Not Validated", which is counted as a warning.
  cy.intercept(
    {
      method: 'GET',
      pathname: '**/api/istio/config'
    },
    {
      statusCode: 200,
      body: istioConfigsWithNoValidations
    }
  ).as('allIstioConfigs');
});

const getControlPlanesCard = (): Cypress.Chainable => {
  return cy.contains('Control planes').closest('div[data-ouia-component-type="PF6/Card"]');
};

const makeControlPlane = (opts: { clusterName: string; istiodName: string; status: 'Healthy' | 'Unhealthy' }): any => {
  return {
    cluster: {
      accessible: true,
      apiEndpoint: '',
      isKialiHome: true,
      kialiInstances: [],
      name: opts.clusterName,
      secretName: ''
    },
    config: {},
    istiodName: opts.istiodName,
    revision: 'default',
    status: opts.status,
    thresholds: {}
  };
};

Given('Control planes API responds slowly', () => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      delay: 2000,
      statusCode: 200,
      body: []
    }
  ).as('controlPlanes');
});

Given('Control planes API fails', () => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 500,
      body: {}
    }
  ).as('controlPlanes');
});

Given('Control planes API returns 1 unhealthy control plane in cluster {string}', (clusterName: string) => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 200,
      body: [
        makeControlPlane({
          clusterName,
          istiodName: `istiod-${clusterName.toLowerCase()}`,
          status: 'Unhealthy'
        })
      ]
    }
  ).as('controlPlanes');
});

Then('Control planes card shows loading state without count or footer link', () => {
  // Ensure we are still in loading state (don't wait for the response).
  getControlPlanesCard().within(() => {
    cy.contains('Fetching control plane data').should('be.visible');
    cy.contains('Control planes (').should('not.exist');
    cy.contains('View control planes').should('not.exist');
  });
});

Then('Control planes card shows error state without count or footer link', () => {
  cy.wait('@controlPlanes');
  getControlPlanesCard().within(() => {
    cy.contains('Control planes could not be loaded').should('be.visible');
    cy.contains('Try Again').should('be.visible');
    cy.contains('Control planes (').should('not.exist');
    cy.contains('View control planes').should('not.exist');
  });
});

When('Control planes API succeeds with 1 healthy control plane', () => {
  cy.intercept(
    {
      method: 'GET',
      pathname: CONTROL_PLANES_API_PATHNAME
    },
    {
      statusCode: 200,
      body: [makeControlPlane({ clusterName: 'Kubernetes', istiodName: 'istiod-kubernetes', status: 'Healthy' })]
    }
  ).as('controlPlanesRetry');
});

When('user clicks Try Again in Control planes card', () => {
  getControlPlanesCard().within(() => {
    cy.contains('button', 'Try Again').should('be.visible').click();
  });
  cy.wait('@controlPlanesRetry');
});

Then('Control planes card shows count {int} and footer link', (count: number) => {
  getControlPlanesCard().within(() => {
    cy.contains(`Control planes (${count})`).should('be.visible');
    cy.contains('View control planes').should('be.visible');
  });
});

When('user opens the Control planes issues popover', () => {
  cy.wait('@controlPlanes').its('response.statusCode').should('eq', 200);
  cy.getBySel('control-planes-issues').should('be.visible').click();
});

When('user clicks the {string} control plane link in the popover', (istiodName: string) => {
  cy.contains('a', istiodName).should('be.visible').click();
});

Then('user is redirected to Mesh page with cluster filter {string}', (clusterName: string) => {
  cy.location('pathname').should('match', /\/console\/mesh$/);
  cy.location('search').then(search => {
    const params = new URLSearchParams(search);
    expect(params.get('meshHide')).to.eq(`cluster!=${clusterName}`);
  });
});

When('user opens the Istio configs warnings popover', () => {
  cy.wait('@allIstioConfigs').its('response.statusCode').should('eq', 200);
  cy.getBySel('istio-configs-warnings').should('be.visible').click();
  cy.contains('View warning Istio configs').should('be.visible');
});

When('user clicks the {string} popover action', (label: string) => {
  cy.contains('button', label).should('be.visible').click();
});

Then('user is redirected to Istio config list with all namespaces and warning filters', () => {
  cy.location('pathname').should('match', /\/console\/istio$/);

  cy.location('search').then(search => {
    const params = new URLSearchParams(search);

    // Filters from the "View all" navigation
    expect(params.getAll('config')).to.include.members(['Warning', 'Not Validated']);
    expect(params.get('opLabel')).to.eq('or');

    // Selecting all namespaces is encoded as a comma-separated list
    const urlNamespaces = Array.from(
      new Set(
        (params.get('namespaces') ?? '')
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
      )
    ).sort();

    cy.request('api/namespaces').then(resp => {
      const allNamespaces = Array.from(new Set((resp.body as Array<{ name: string }>).map(ns => ns.name))).sort();
      expect(urlNamespaces).to.deep.eq(allNamespaces);
    });
  });
});
