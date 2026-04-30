export const ensureKialiFinishedLoading = (): void => {
  cy.getBySel('loading-screen').should('not.exist');
  cy.getBySel('login-form').should('not.exist');
  cy.get('#loading_kiali_spinner').should('not.exist');
};

const KIALI_API_READY_TIMEOUT_MS = 120000;
const KIALI_API_READY_POLL_MS = 5000;
const RESOURCE_DELETION_TIMEOUT_MS = 120000;
const RESOURCE_DELETION_POLL_MS = 3000;

/**
 * Waits for the Kiali API to be ready (e.g. after a restart from enableKialiFeature).
 * Polls /api/status until it returns 200 or the timeout is reached.
 */
export const waitForKialiApiReady = (timeoutMs = KIALI_API_READY_TIMEOUT_MS): void => {
  const start = Date.now();

  cy.log(`Wait for Kiali API to be ready for ${timeoutMs}ms`);
  function attempt(): void {
    cy.request({ url: '/api/status', failOnStatusCode: false }).then(resp => {
      if (resp.status === 200) {
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        throw new Error(
          `Timed out waiting for Kiali API to be ready (last status: ${resp.status}) after ${timeoutMs}ms`
        );
      }
      cy.wait(KIALI_API_READY_POLL_MS);
      attempt();
    });
  }

  attempt();
};

export const waitForResourceDeletion = (
  namespace: string,
  kind: string,
  name: string,
  timeoutMs = RESOURCE_DELETION_TIMEOUT_MS,
  pollIntervalMs = RESOURCE_DELETION_POLL_MS
): Cypress.Chainable<unknown> => {
  const startTime = Date.now();
  const command = `kubectl -n ${namespace} get ${kind} ${name} --ignore-not-found -o name`;

  const waitUntilDeleted = (): Cypress.Chainable<unknown> => {
    return cy.exec(command, { failOnNonZeroExit: false }).then(result => {
      const resourceName = result.stdout.trim();
      if (resourceName === '') {
        cy.log(`${kind}/${name} was deleted from namespace ${namespace}`);
        return cy.wrap(null);
      }

      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for ${kind}/${name} to be deleted from namespace ${namespace}`
        );
      }

      cy.log(`${kind}/${name} still exists in namespace ${namespace}; waiting ${pollIntervalMs}ms before retry`);
      cy.wait(pollIntervalMs);
      return waitUntilDeleted();
    });
  };

  return waitUntilDeleted();
};

export const openTab = (tab: string): void => {
  cy.get('#basic-tabs', { timeout: 60000 }).should('exist').scrollIntoView().contains(tab).click();
};
