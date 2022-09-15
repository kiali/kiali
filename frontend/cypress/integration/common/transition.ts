export function ensureKialiFinishedLoading() {
  cy.getBySel('loading-screen').should('not.exist');
  cy.getBySel('login-form').should('not.exist');
  cy.get('#loading_kiali_spinner').should('not.exist');
}

export function openTab(tab: string) {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
}
