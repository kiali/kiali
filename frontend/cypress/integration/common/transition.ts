export const ensureKialiFinishedLoading = (): void => {
  cy.getBySel('loading-screen').should('not.exist');
  cy.getBySel('login-form').should('not.exist');

  cy.get('#loading_kiali_spinner').should('not.exist');
};

export const openTab = (tab: string): void => {
  cy.get('#basic-tabs').should('be.visible').contains(tab).click();
};
