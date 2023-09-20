export function activeFilters(count:number){
  cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 }).should('be.visible').find('[data-ouia-component-id="close"]')
    .each(() => {
    })
    .then(($lis) => {
      cy.wrap($lis).should('have.length', count);
  });
}

export function showMore(){
  cy.get('button[data-ouia-component-type="PF5/OverflowChip"]', { timeout: 1000 }).click();
  // cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 }).contains('more').should('be.visible');
  // cy.get('#filter-selection > :nth-child(2)').contains('more').click();
  // cy.get('#filter-selection > :nth-child(2)', { timeout: 1000 }).contains('more').should('not.exist');
}

