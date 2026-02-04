import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

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
