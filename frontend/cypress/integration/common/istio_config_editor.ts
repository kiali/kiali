import { Then, And } from '@badeball/cypress-cucumber-preprocessor';

Then('user can see istio config editor', () => {
	cy.get('#ace-editor').should('be.visible');
})

And('cluster badge for {string} cluster should be visible in the side panel',(cluster:string) => {
	cy.get('h3').contains('Overview').parent().parent().find('#pfbadge-C').should('be.visible');
});
