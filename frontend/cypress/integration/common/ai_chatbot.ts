import { Then, When } from '@badeball/cypress-cucumber-preprocessor';

const CHATBOT_TOGGLE = '[data-test="ai-chatbot-toggle"]';
const CHATBOT_VISIBLE = '.pf-chatbot.pf-chatbot--visible';
const CHATBOT_HIDDEN = '.pf-chatbot.pf-chatbot--hidden';
const CHATBOT_WELCOME_TITLE = '.pf-chatbot__hello';
const CHATBOT_WELCOME_DESCRIPTION = '.pf-chatbot__question';

Then('the AI chatbot toggle button should be visible', () => {
  cy.get(CHATBOT_TOGGLE).should('be.visible');
});

When('user clicks the AI chatbot toggle', () => {
  cy.get(CHATBOT_TOGGLE).click();
});

Then('the AI chatbot window should be open', () => {
  cy.get(CHATBOT_VISIBLE).should('exist');
});

Then('the AI chatbot window should be closed', () => {
  cy.get(CHATBOT_HIDDEN).should('exist');
});

Then('the AI chatbot should display a welcome message', () => {
  cy.get(CHATBOT_WELCOME_TITLE).should('be.visible').and('contain.text', 'Welcome to Kiali Chatbot');
  cy.get(CHATBOT_WELCOME_DESCRIPTION).should('be.visible').and('contain.text', 'How may I help you today?');
});
