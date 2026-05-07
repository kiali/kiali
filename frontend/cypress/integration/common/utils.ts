import { MeshCluster } from 'types/Mesh';

const escapeCssAttrValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * In OSSMC kiosk mode, KialiLink renders <button data-href> instead of <a href>.
 * This selector matches both so tests work in standalone Kiali and OSSMC.
 * When called without arguments, returns a selector matching any link-like element.
 */
export const linkSelector = (hrefPattern?: string, match: 'contains' | 'endsWith' | 'exact' = 'contains'): string => {
  if (!hrefPattern) {
    return 'a, button[data-href]';
  }
  const escaped = escapeCssAttrValue(hrefPattern);
  const op = match === 'exact' ? '' : match === 'endsWith' ? '$' : '*';
  return `a[href${op}="${escaped}"], button[data-href${op}="${escaped}"]`;
};

// Check if the element has at least one of the expected CSS classes.
export const hasAtLeastOneClass = (expectedClasses: string[]): (($el: HTMLElement[]) => boolean) => {
  return ($el: HTMLElement[]) => {
    const classList = Array.from($el[0].classList);
    return expectedClasses.some((expectedClass: string) => classList.includes(expectedClass));
  };
};

/**
 * Normalize a browser pathname to Kiali's canonical format so that
 * paths from standalone Kiali and OSSMC can be compared directly.
 *
 * Kiali standalone: /console/namespaces/{ns}/services/{svc}
 * OSSMC:            /k8s/ns/{ns}/services/{svc}/ossmconsole
 * Canonical result: /namespaces/{ns}/services/{svc}
 */
export const normalizeKialiPath = (pathname: string): string => {
  if (Cypress.env('OSSMC')) {
    return pathname.replace(/\/ossmconsole$/, '').replace(/^\/k8s\/ns\//, '/namespaces/');
  }
  return pathname.replace(/^\/console/, '');
};

/**
 * Fetches /api/config, asserts exactly one cluster exists, and yields
 * its name. Intended for single-cluster test environments.
 */
export const getClusterForSingleCluster = (): Cypress.Chainable<string> => {
  return cy.request({ url: 'api/config' }).then(response => {
    cy.wrap(response.isOkStatusCode).should('be.true');

    const clusters: { [key: string]: MeshCluster } = response.body.clusters;
    const clusterNames = Object.keys(clusters);
    cy.wrap(clusterNames).should('have.length', 1);
    const cluster = clusterNames[0];

    return cy.wrap(cluster);
  });
};
