export function ensureKialiFinishedLoading() {
  cy.get('#loading_kiali_spinner').should('not.exist');
  cy.getBySel('loading-screen').should('not.exist');
}
