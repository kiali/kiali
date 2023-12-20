import { Given } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

enum detailType {
  App = 'app',
  Workload = 'workload',
  Service = 'service'
}

Given('user is at the {string} list page', (page: string) => {
  // enable toggles on the list pages so that they can be tested
  cy.intercept(`${Cypress.config('baseUrl')}/api/config`, request => {
    request.reply(response => {
      response.body['kialiFeatureFlags']['uiDefaults']['list']['showIncludeToggles'] = true;
      return response;
    });
  }).as('config');

  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(`${Cypress.config('baseUrl')}/console/${page}?refresh=0`);
  cy.wait('@config');
});

Given('user is at the {string} page', (page: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(`${Cypress.config('baseUrl')}/console/${page}?refresh=0`);
});

Given(
  'user is at the details page for the {string} {string} located in the {string} cluster',
  (detail: detailType, namespacedNamed: string, cluster: string) => {
    // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
    if (cluster !== '') {
      cluster = `&clusterName=${cluster}`;
    }

    const namespaceAndName = namespacedNamed.split('/');
    const namespace = namespaceAndName[0];
    const name = namespaceAndName[1];

    let pageDetail: string;

    switch (detail) {
      case detailType.App:
        pageDetail = 'applications';
        break;
      case detailType.Service:
        pageDetail = 'services';

        cy.intercept({
          pathname: '**/api/namespaces/bookinfo/services/productpage',
          query: {
            objects: ''
          }
        }).as('waitForCall');

        break;
      case detailType.Workload:
        pageDetail = 'workloads';
        break;
    }

    cy.visit(`${Cypress.config('baseUrl')}/console/namespaces/${namespace}/${pageDetail}/${name}?refresh=0${cluster}`);

    ensureKialiFinishedLoading();
  }
);

// A simple function to check whether the DOM (or a subset of DOM has the cluster parameter in its links). This is related to multi-cluster testing.
export const clusterParameterExists = (present: boolean): void => {
  let exist = '';

  if (!present) {
    exist = 'not.';
  }

  cy.get('a').each($el => {
    cy.wrap($el).should('have.attr', 'href').and(`${exist}include`, 'clusterName=');
  });
};
