import { MeshCluster } from 'types/Mesh';

/**
 * In OSSMC kiosk mode, KialiLink renders <button data-href> instead of <a href>.
 * This selector matches both so tests work in standalone Kiali and OSSMC.
 */
export const linkSelector = (hrefPattern: string, match: 'contains' | 'endsWith' = 'contains'): string => {
  const op = match === 'endsWith' ? '$' : '*';
  return `a[href${op}="${hrefPattern}"], button[data-href${op}="${hrefPattern}"]`;
};

// Check if the element has at least one of the expected CSS classes.
export const hasAtLeastOneClass = (expectedClasses: string[]): (($el: HTMLElement[]) => boolean) => {
  return ($el: HTMLElement[]) => {
    const classList = Array.from($el[0].classList);
    return expectedClasses.some((expectedClass: string) => classList.includes(expectedClass));
  };
};

/**
 * Fetches /api/config, asserts exactly one cluster exists, and yields
 * its name. Intended for single-cluster test environments.
 */
export const getClusterForSingleCluster = (): Cypress.Chainable<string> => {
  return cy.request({ url: '/api/config' }).then(response => {
    cy.wrap(response.isOkStatusCode).should('be.true');

    const clusters: { [key: string]: MeshCluster } = response.body.clusters;
    const clusterNames = Object.keys(clusters);
    cy.wrap(clusterNames).should('have.length', 1);
    const cluster = clusterNames[0];

    return cy.wrap(cluster);
  });
};
