export function activeFilters(count:number){
  cy.get('#filter-selection > :nth-child(2)').find('[aria-label="close"]')
    .each(() => {
    })
    .then(($lis) => {
      cy.wrap($lis).should('have.length', count);
  }); 
}

export function showMore(){
  cy.get('#filter-selection > :nth-child(2)').contains('more').click();
}

