export const activeFilters = (count: number): void => {
  cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 })
    .should('be.visible')
    .find('button[aria-label^="Close "]')
    .each(() => {})
    .then($lis => {
      cy.wrap($lis).should('have.length', count);
    });
};

export const showMore = (): void => {
  cy.get('#filter-selection button.pf-v6-c-label.pf-m-overflow', { timeout: 1000 }).click();
};
