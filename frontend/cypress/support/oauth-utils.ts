// Cached OAuth origin — persists across step definitions and command calls
// within a single spec run. Safe because the OAuth server doesn't change
// mid-run, and cy.session() isolation only affects cookies/storage, not
// JavaScript module state.
let cachedOrigin: string | undefined;

/**
 * Discovers the OAuth server origin by probing Kiali's /api/auth/redirect
 * endpoint (via cy.request, which runs in Node.js and is not subject to
 * browser CORS restrictions) and following its redirect chain.
 *
 * Needed because Cypress 15 enforces strict origin boundaries — any
 * interaction with a cross-origin OAuth form must be wrapped in cy.origin().
 *
 * Results are cached at module level so repeated calls within a spec run
 * skip the network probe.
 */
export function discoverOAuthOrigin(): Cypress.Chainable<string> {
  if (cachedOrigin !== undefined) {
    return cy.wrap(cachedOrigin);
  }
  return cy.request({ url: 'api/auth/redirect', followRedirect: true, failOnStatusCode: false }).then(resp => {
    const lastRedirect = resp.redirects?.at(-1);
    const redirectUrl = lastRedirect ? lastRedirect.split(' ').pop() : undefined;
    const baseOrigin = new URL(Cypress.config('baseUrl')!).origin;
    let origin: string;
    try {
      origin = redirectUrl ? new URL(redirectUrl).origin : baseOrigin;
    } catch {
      cy.log(`Could not parse OAuth redirect URL "${redirectUrl}", falling back to baseUrl origin`);
      origin = baseOrigin;
    }
    cachedOrigin = origin;
    return origin;
  });
}
