import { And, Given } from 'cypress-cucumber-preprocessor/steps';
import { ensureKialiFinishedLoading } from './transition';

enum detailType {
  App = 'app',
  Workload = 'workload',
  Service = 'service'
}

Given('user is at the {string} page', (page: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
  cy.visit(Cypress.config('baseUrl') + `/console/${page}?refresh=0`);
});

And('user is at the details page for the {string} {string}', (detail: detailType, namespacedNamed: string) => {
  // Forcing "Pause" to not cause unhandled promises from the browser when cypress is testing
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
      break;
    case detailType.Workload:
      pageDetail = 'workloads';
      break;
  }
  cy.visit(Cypress.config('baseUrl') + `/console/namespaces/${namespace}/${pageDetail}/${name}?refresh=0`);
  ensureKialiFinishedLoading();
});
