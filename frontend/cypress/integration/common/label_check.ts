export const activeFilters = (count: number): void => {
  cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 })
    .should('be.visible')
    .find('[data-ouia-component-id="close"]')
    .each(() => {})
    .then($lis => {
      cy.wrap($lis).should('have.length', count);
    });
};

export const showMore = (): void => {
  cy.get('button[data-ouia-component-type="PF5/OverflowChip"]', { timeout: 1000 }).click();
};
