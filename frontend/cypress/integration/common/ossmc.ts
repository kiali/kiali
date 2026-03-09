import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const waitForNamespaceLabel = (namespace: string, expected: string, maxRetries = 18, retryCount = 0): void => {
  if (retryCount >= maxRetries) {
    throw new Error(
      `Label not found after ${maxRetries} retries (namespace=${namespace}, expected=${expected}, baseUrl=${Cypress.config(
        'baseUrl'
      )})`
    );
  }

  const idx = expected.indexOf('=');
  const labelKey = idx >= 0 ? expected.slice(0, idx) : expected;
  const labelValue = idx >= 0 ? expected.slice(idx + 1) : undefined;

  cy.request({ method: 'GET', url: `${Cypress.config('baseUrl')}/api/namespaces` }).then(resp => {
    expect(resp.status).to.equal(200);
    const namespaces = Array.isArray(resp.body) ? resp.body : [];
    const nsObj = namespaces.find((n: any) => n?.name === namespace);
    const labels: Record<string, string> = nsObj?.labels ?? {};
    const actual = labels[labelKey];

    const ok = labelValue === undefined ? actual !== undefined : actual === labelValue;
    if (ok) {
      return;
    }

    return cy.wait(2000).then(() => waitForNamespaceLabel(namespace, expected, maxRetries, retryCount + 1));
  });
};

When(
  'Namespace {string} is labeled with the waypoint label {string} via API',
  (namespace: string, waypoint: string) => {
    // This emulates the UI action "Add to Ambient" (not available in OSSMC).
    // JSON Merge Patch: setting a field to null removes it.
    const patch = {
      metadata: {
        labels: {
          'istio-injection': null,
          'istio.io/use-waypoint': waypoint
        }
      }
    };

    cy.request({
      method: 'PATCH',
      url: `${Cypress.config('baseUrl')}/api/namespaces/${namespace}`,
      body: patch,
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false
    }).then(resp => {
      expect(resp.status).to.equal(200);
    });
  }
);

Then('the {string} namespace has the label {string}', (namespace: string, label: string) => {
  waitForNamespaceLabel(namespace, label);
});
