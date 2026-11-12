import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import { mockTroubleshootingIssues } from './troubleshooting_mocks';

/**
 * Cypress steps for the standalone Troubleshooting page (/console/troubleshooting),
 * Overview Troubleshooting card, and left-nav entry.
 *
 * These do not require AI / chat to be enabled. Ask / Fix with AI gating is covered
 * in ai_dashboard.feature; chatbot launch from a subproblem is covered in ai_chatbot.feature.
 */

Given('the troubleshooting scan returns mesh problems', () => {
  cy.window().then(win => {
    win.sessionStorage.removeItem('kiali.ai.troubleshooting.hiddenSubProblemIds');
  });
  cy.intercept('POST', '**/api/ai/troubleshooting', {
    statusCode: 200,
    body: mockTroubleshootingIssues
  }).as('troubleshootingScan');
});

When('user visits the Troubleshooting page', () => {
  cy.visit({
    url: `${Cypress.config('baseUrl')}/console/troubleshooting`,
    qs: { refresh: '0' }
  });
  cy.wait('@troubleshootingScan', { timeout: 15000 });
  cy.get('[data-test="troubleshooting-page"]', { timeout: 10000 }).should('be.visible');
  cy.get('[data-test="ai-troubleshooting"]', { timeout: 15000 }).should('be.visible');
});

Then('the Troubleshooting page should be shown', () => {
  cy.get('[data-test="troubleshooting-page"]', { timeout: 10000 }).should('be.visible');
  cy.get('[data-test="ai-troubleshooting"]').should('be.visible');
});

Then('the browser should be on the Troubleshooting page', () => {
  cy.location('pathname', { timeout: 10000 }).should('match', /\/(console|ossmconsole)\/troubleshooting$/);
});

Then('the troubleshooting summary should contain {string}', (text: string) => {
  cy.get('[data-test="ai-troubleshooting-summary"]', { timeout: 10000 }).should('be.visible').and('contain.text', text);
});

Then('the Troubleshooting page should show issue {string}', (issueText: string) => {
  cy.get('[data-test="ai-troubleshooting-issue"]').should('contain.text', issueText);
});

Then('the Troubleshooting page should show subproblem {string}', (subProblemText: string) => {
  cy.get('[data-test="ai-troubleshooting-subproblem"]').should('contain.text', subProblemText);
});

Then('the Troubleshooting page should show a {string} link to {string}', (linkText: string, href: string) => {
  cy.contains(
    '[data-test="ai-troubleshooting-subproblem"] a, [data-test="ai-troubleshooting-subproblem"] button',
    linkText
  )
    .should('be.visible')
    .and($el => {
      const actual = $el.attr('href') || $el.attr('data-href') || '';
      expect(actual).to.include(href);
    });
});

Then('Istio object subproblems should not show inline Ask AI buttons', () => {
  // Ask AI lives only in the header kebab menu, not beside validation checks.
  cy.get('[data-test="ai-troubleshooting-check"]').should('exist');
  cy.get('[data-test="ai-troubleshooting-check"] [data-test="ai-troubleshooting-ask-chatbot"]').should('not.exist');
});

When('user hides the first troubleshooting subproblem', () => {
  cy.get('[data-test="ai-troubleshooting-hide-subproblem"]').first().click();
});

Then('the hidden troubleshooting problems section should be visible', () => {
  cy.get('[data-test="ai-troubleshooting-hidden"]').should('be.visible');
});

When('user expands the hidden troubleshooting problems section', () => {
  // Toolbar "Show ignored" label toggles the same hiddenExpanded state as the ExpandableSection.
  cy.get('[data-test="ai-troubleshooting-toggle-ignored"]').click();
});

When('user shows the first hidden troubleshooting subproblem', () => {
  cy.get('[data-test="ai-troubleshooting-show-subproblem"]').first().click();
});

Then('the hidden troubleshooting problems section should not exist', () => {
  cy.get('[data-test="ai-troubleshooting-hidden"]').should('not.exist');
});

Then('the Troubleshooting menu item should be visible', () => {
  // Menu Link id comes from routes.tsx nav item id="troubleshooting".
  cy.get('#troubleshooting', { timeout: 10000 }).should('be.visible').and('contain.text', 'Troubleshooting');
});

When('user visits the overview page', () => {
  cy.visit({
    url: `${Cypress.config('baseUrl')}/console/overview`,
    qs: { refresh: '0' }
  });
});

Then('the Overview Troubleshooting card should be visible', () => {
  cy.get('[data-test="overview-troubleshooting-card"]', { timeout: 15000 }).should('be.visible');
});

Then(
  'the Overview Troubleshooting card should show {int} critical and {int} warning',
  (critical: number, warning: number) => {
    cy.get('[data-test="overview-troubleshooting-critical"]', { timeout: 10000 }).should(
      'contain.text',
      String(critical)
    );
    cy.get('[data-test="overview-troubleshooting-warning"]').should('contain.text', String(warning));
  }
);

When('user clicks View Troubleshooting on the Overview card', () => {
  cy.get('[data-test="overview-troubleshooting-view-link"]', { timeout: 10000 }).click();
});

When('user opens the notification drawer', () => {
  cy.get('[data-test="notifications-badge"]').first().click();
});

Then('the notification drawer should be open', () => {
  cy.get('.pf-v6-c-page__drawer > .pf-v6-c-drawer').should('have.class', 'pf-m-expanded');
});

Then('the notification drawer should be closed', () => {
  cy.get('.pf-v6-c-page__drawer > .pf-v6-c-drawer').should('not.have.class', 'pf-m-expanded');
});

Then('the notification drawer should not show the troubleshooting section', () => {
  cy.get('[data-test="troubleshooting-notification-section"]').should('not.exist');
  cy.get('[data-test="troubleshooting-notification-link"]').should('not.exist');
});

Then('the notification badge should not show the AI icon', () => {
  cy.get('[data-test="notifications-ai-icon"]').should('not.exist');
  cy.get('[data-test="notifications-troubleshooting-icon"]').should('not.exist');
});

// AI actions kebab (Ask AI / Fix it with AI) on the Troubleshooting page
Then('the AI actions menu on troubleshooting problems should be enabled', () => {
  cy.get('[data-test="ai-troubleshooting-ai-actions"]', { timeout: 10000 }).first().should('not.be.disabled');
});

Then('the AI actions menu on troubleshooting problems should be disabled', () => {
  cy.get('[data-test="ai-troubleshooting-ai-actions"]', { timeout: 10000 }).first().should('be.disabled');
});

Then('the AI actions menu on troubleshooting problems should not exist', () => {
  cy.get('[data-test="ai-troubleshooting-ai-actions"]').should('not.exist');
});

Then('the AI actions menu should include Ask AI and Fix it with AI', () => {
  cy.get('[data-test="ai-troubleshooting-ai-actions"]', { timeout: 10000 }).first().should('not.be.disabled').click();
  cy.get('[data-test="ai-troubleshooting-ask-chatbot"]')
    .should('be.visible')
    .and('not.have.attr', 'aria-disabled', 'true');
  cy.get('[data-test="ai-troubleshooting-analyze"]').should('be.visible').and('not.have.attr', 'aria-disabled', 'true');
  cy.get('body').type('{esc}');
});
