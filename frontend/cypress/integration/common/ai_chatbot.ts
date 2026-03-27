import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { autoNavigatePayload, mockPayload, multipleActionsPayload, singleActionPayload } from './ai_chatbot_mocks';

const CHATBOT_TOGGLE = '[data-test="ai-chatbot-toggle"]';
const CHATBOT_VISIBLE = '.pf-chatbot.pf-chatbot--visible';
const CHATBOT_HIDDEN = '.pf-chatbot.pf-chatbot--hidden';
const CHATBOT_WELCOME_TITLE = '.pf-chatbot__hello';
const CHATBOT_WELCOME_DESCRIPTION = '.pf-chatbot__question';
const CHATBOT_MESSAGE_INPUT = '[data-testid="chatbot-message-bar-input"]';
const CHATBOT_SEND_BUTTON = '.pf-chatbot__button--send';
const CHATBOT_SOURCES = '.pf-chatbot__source';
const CHATBOT_ALWAYS_NAVIGATE_SWITCH = '[data-testid="chatbot-always-navigate-switch"]';
const CHATBOT_NAVIGATION_ACTION = '[data-testid="chatbot-navigation-action"]';
const CHATBOT_NAVIGATION_ACTION_LINK = '[data-testid^="chatbot-navigation-action-link-"]';

let lastResponseAlias = '';

function sendMessageWithMockedResponse(message: string, payload: object, alias: string): void {
  lastResponseAlias = alias;

  cy.intercept('POST', '**/api/chat/**/ai', {
    statusCode: 200,
    body: payload
  }).as(alias);

  cy.get(CHATBOT_MESSAGE_INPUT).type(message);
  cy.get(CHATBOT_SEND_BUTTON).click();
}

function waitForResponseAndValidateAnswer(alias: string, expectedAnswer: string): void {
  cy.wait(`@${alias}`, { timeout: 10000 })
    .its('response')
    .then(response => {
      expect(response.statusCode).to.eq(200);
    });

  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).should('contain.text', expectedAnswer);
}

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

When('user sends a message {string}', (message: string) => {
  sendMessageWithMockedResponse(message, mockPayload, 'chatAIResponse');
});

Then('the AI chatbot should display a sources card', () => {
  cy.wait('@chatAIResponse', { timeout: 10000 })
    .its('response')
    .then(response => {
      expect(response.statusCode).to.eq(200);
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;

      const docs = body.referenced_docs;
      expect(docs).to.be.an('array').and.have.length.greaterThan(0);
      cy.wrap(docs.length).as('sourceCount');
    });

  cy.get('@sourceCount').then(count => {
    cy.get(CHATBOT_SOURCES, { timeout: 10000 }).should('exist').and('contain.text', `${count} sources`);
  });
});

function toggleAlwaysNavigateSwitch(enable: boolean): void {
  const current = enable ? 'not.be.checked' : 'be.checked';
  const expected = enable ? 'be.checked' : 'not.be.checked';

  cy.get(CHATBOT_ALWAYS_NAVIGATE_SWITCH).should('exist').and(current).click({ force: true });
  cy.get(CHATBOT_ALWAYS_NAVIGATE_SWITCH).should(expected);
}

Then('the always navigate switch should be unchecked', () => {
  cy.get(CHATBOT_ALWAYS_NAVIGATE_SWITCH).should('exist').and('not.be.checked');
});

When('user enables the always navigate switch', () => {
  toggleAlwaysNavigateSwitch(true);
});

When('user disables the always navigate switch', () => {
  toggleAlwaysNavigateSwitch(false);
});

When('user sends a message with actions {string}', (message: string) => {
  sendMessageWithMockedResponse(message, singleActionPayload, 'chatAIActionResponse');
});

When('user sends a message with multiple actions {string}', (message: string) => {
  sendMessageWithMockedResponse(message, multipleActionsPayload, 'chatAIActionResponse');
});

Then('the AI chatbot should display the answer {string}', (expectedAnswer: string) => {
  waitForResponseAndValidateAnswer(lastResponseAlias, expectedAnswer);
});

Then('the navigation actions container should be visible with {int} links', (count: number) => {
  cy.get(CHATBOT_NAVIGATION_ACTION, { timeout: 10000 })
    .should('exist')
    .within(() => {
      cy.get(CHATBOT_NAVIGATION_ACTION_LINK).should('have.length', count);
    });
});

When('user sends a message with auto navigate {string}', (message: string) => {
  sendMessageWithMockedResponse(message, autoNavigatePayload, 'chatAIAutoNavigateResponse');
});

Then('the navigation actions container should not be visible', () => {
  cy.get(CHATBOT_NAVIGATION_ACTION).should('not.exist');
});

Then('the URL should contain {string}', (path: string) => {
  cy.url().should('include', path);
});
