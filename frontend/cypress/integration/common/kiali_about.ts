import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

When('user clicks on Help Button', () => {
  cy.getBySel('about-help-button').click();
});

When('user clicks on About Button', () => {
  cy.get('li[role="none"]').contains('About').click();
});

Then(`user see Kiali brand`, () => {
  cy.contains('Kiali').should('be.visible');
  cy.contains('Kiali Container').should('be.visible');
  cy.contains('Visit the Mesh page').should('be.visible');
  cy.get('[href="https://www.kiali.io"]').should('have.attr', 'href');
  cy.get('[href="https://github.com/kiali"]').should('have.attr', 'href');
});

Then(`user see valid version information`, () => {
  // Find the Kiali version field (server version)
  cy.contains('dt', 'Kiali')
    .next('dd')
    .should('be.visible')
    .should('not.contain', 'undefined')
    .should('not.be.empty')
    .invoke('text')
    .should('match', /^.+$/) // Should contain some text
    .and('have.length.greaterThan', 0); // Should not be empty string

  // Find the Kiali Container version field
  cy.contains('dt', 'Kiali Container')
    .next('dd')
    .should('be.visible')
    .should('not.contain', 'undefined')
    .should('not.be.empty')
    .invoke('text')
    .should('match', /^.+$/) // Should contain some text
    .and('have.length.greaterThan', 0); // Should not be empty string

  // Additional validation: ensure versions contain meaningful content
  // (not just whitespace or other placeholder text)
  cy.contains('dt', 'Kiali')
    .next('dd')
    .invoke('text')
    .then(text => {
      expect(text.trim()).to.not.equal('');
      expect(text.trim()).to.not.equal('unknown');
      expect(text.trim()).to.not.equal('null');
    });

  cy.contains('dt', 'Kiali Container')
    .next('dd')
    .invoke('text')
    .then(text => {
      expect(text.trim()).to.not.equal('');
      expect(text.trim()).to.not.equal('unknown');
      expect(text.trim()).to.not.equal('null');
    });
});
