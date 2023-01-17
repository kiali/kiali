export function activeFilters(count:number){
  cy.get('#filter-selection > :nth-child(2)').find('[data-ouia-component-id="close"]')
    .each(() => {
    })
    .then(($lis) => {
      cy.wrap($lis).should('have.length', count);
  }); 
}

export function showMore(){
  cy.get('#filter-selection > :nth-child(2)').contains('more').click();
  cy.get('#filter-selection > :nth-child(2)').contains('more').should('not.exist');
}

