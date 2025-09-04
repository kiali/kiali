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
  // Test Kiali server version using data-test attribute
  cy.get('[data-test="kiali-version"]')
    .should('be.visible')
    .should('not.contain', 'undefined')
    .should('not.be.empty')
    .invoke('text')
    .then(text => {
      expect(text.trim()).to.not.equal('');
      expect(text.trim()).to.not.equal('unknown');
      expect(text.trim()).to.not.equal('null');
      expect(text.trim()).to.have.length.greaterThan(0);
    });

  // Test Kiali container version using data-test attribute
  cy.get('[data-test="kiali-container-version"]')
    .should('be.visible')
    .should('not.contain', 'undefined')
    .should('not.be.empty')
    .invoke('text')
    .then(text => {
      expect(text.trim()).to.not.equal('');
      expect(text.trim()).to.not.equal('unknown');
      expect(text.trim()).to.not.equal('null');
      expect(text.trim()).to.have.length.greaterThan(0);
    });
});
