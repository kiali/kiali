export const ensureKialiFinishedLoading = (): void => {
  cy.getBySel('loading-screen').should('not.exist');
  cy.getBySel('login-form').should('not.exist');
  cy.get('#loading_kiali_spinner').should('not.exist');
};

const KIALI_API_READY_TIMEOUT_MS = 120000;
const KIALI_API_READY_POLL_MS = 5000;

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

export const openTab = (tab: string): void => {
  cy.get('#basic-tabs', { timeout: 60000 }).should('exist').contains(tab).click(); // Can be very slow for OpenShift, specially in the UI
};
