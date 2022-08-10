import { Then } from 'cypress-cucumber-preprocessor/steps';

Then('user can see istio config editor', () => {
	cy.get('#ace-editor').should('be.visible');
})
