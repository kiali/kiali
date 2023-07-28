import { Then } from '@badeball/cypress-cucumber-preprocessor';
import { ensureKialiFinishedLoading } from './transition';

Then(`user should see no Istio Components Status`, () => {
  ensureKialiFinishedLoading(); 
  cy.get('#istio-status-danger').should('not.be.visible');
});
