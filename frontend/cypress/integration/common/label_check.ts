export const activeFilters = (count: number): void => {
  cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 })
    .should('be.visible')
    .find('[data-ouia-component-id^="OUIA-Generated-Button-plain"]')
    .each(() => {})
    .then($lis => {
      cy.wrap($lis).should('have.length', count);
    });
};

export const showMore = (): void => {
  cy.get('button.pf-m-overflow', { timeout: 1000 }).click();
};
