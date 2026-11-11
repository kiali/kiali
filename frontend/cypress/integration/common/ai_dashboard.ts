import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import type { DataTable } from '@badeball/cypress-cucumber-preprocessor';
import { mockTroubleshootingIssues } from './ai_chatbot_mocks';

/**
 * Cypress helpers for the AI Dashboard configuration matrix
 * (see ai_dashboard.feature for the full behaviour rules).
 *
 * Feature flags are injected by intercepting GET /api/config so each scenario
 * can force a specific combination of:
 *   - ai.enabled
 *   - ai.chat.enabled / ai.chat.allowed
 *   - ai.consumption.enabled / ai.consumption.allowed
 */

type FeatureFlags = {
  aiEnabled: boolean;
  chatAllowed: boolean;
  chatEnabled: boolean;
  consumptionAllowed: boolean;
  consumptionEnabled: boolean;
};

const defaultFlags = (): FeatureFlags => ({
  aiEnabled: true,
  chatAllowed: true,
  chatEnabled: true,
  consumptionAllowed: true,
  consumptionEnabled: true
});

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim().toLowerCase() === 'true';
};

const parseFeatureTable = (table: DataTable): FeatureFlags => {
  const flags = defaultFlags();
  table.hashes().forEach(row => {
    const feature = (row.feature || '').trim().toLowerCase();
    const enabled = parseBool(row.enabled, false);
    // When "allowed" is omitted, mirror "enabled" (feature on => user allowed).
    const allowed = parseBool(row.allowed, enabled);

    switch (feature) {
      case 'ai':
        flags.aiEnabled = enabled;
        break;
      case 'chat':
        flags.chatEnabled = enabled;
        flags.chatAllowed = allowed;
        break;
      case 'consumption':
        flags.consumptionEnabled = enabled;
        flags.consumptionAllowed = allowed;
        break;
      default:
        throw new Error(`Unknown AI dashboard feature "${row.feature}"`);
    }
  });
  return flags;
};

/** Stub scan + usage APIs so tab content can render without a live AI backend. */
const stubAIDashboardApis = (): void => {
  cy.intercept('POST', '**/api/ai/troubleshooting', {
    statusCode: 200,
    body: mockTroubleshootingIssues
  }).as('aiTroubleshootingScan');

  // Cluster Consumption tab (/api/ai/usage). Registered before /user so the more
  // specific User Usage intercept below wins for /api/ai/usage/user (Cypress LIFO).
  cy.intercept('GET', '**/api/ai/usage**', {
    statusCode: 200,
    body: {
      summary: { byModel: [], byProvider: [] },
      timeSeries: { series: [] },
      tokenUnit: 'millions',
      topSummary: { byModel: [], byProvider: [], byUser: [] }
    }
  }).as('aiConsumptionUsage');

  // User Usage page (current session + optional historic Prometheus series).
  cy.intercept('GET', '**/api/ai/usage/user**', {
    statusCode: 200,
    body: {
      budget: { has_budget: false },
      currentPeriod: {
        summary: { byModel: [], byProvider: [] },
        timeSeries: { window: 'weekly', step: '3600', series: [] },
        tokenUnit: 'millions'
      },
      metrics: {
        summary: { byModel: [], byProvider: [] },
        timeSeries: { window: 'weekly', step: 'weekly', series: [] },
        tokenUnit: 'millions'
      },
      session: []
    }
  }).as('aiSessionUsage');
};

/** Overlay the scenario feature flags onto the real /api/config payload. */
const applyAIConfigFlags = (flags: FeatureFlags): void => {
  cy.intercept('**/api/config', request => {
    request.reply(response => {
      const chat = response.body.ai?.chat ?? {};
      response.body.ai = {
        ...(response.body.ai ?? {}),
        enabled: flags.aiEnabled,
        chat: {
          ...chat,
          allowed: flags.chatAllowed,
          enabled: flags.chatEnabled,
          // Keep providers when chat is enabled so the rest of the UI stays usable.
          providers: flags.chatEnabled ? (chat.providers ?? []) : [],
          defaultProvider: flags.chatEnabled ? (chat.defaultProvider ?? '') : ''
        },
        consumption: {
          enabled: flags.consumptionEnabled,
          allowed: flags.consumptionAllowed
        }
      };
      return response;
    });
  }).as('aiDashboardConfig');
};

Given('AI dashboard features are configured with', (table: DataTable) => {
  const flags = parseFeatureTable(table);
  stubAIDashboardApis();
  applyAIConfigFlags(flags);
});

When('user visits the AI dashboard', () => {
  cy.visit({
    url: `${Cypress.config('baseUrl')}/console/ai`,
    qs: { refresh: '0' }
  });
  cy.wait('@aiDashboardConfig', { timeout: 15000 });
});

When('user visits the AI dashboard on the {string} tab', (tab: string) => {
  cy.visit({
    url: `${Cypress.config('baseUrl')}/console/ai`,
    qs: { refresh: '0', tab }
  });
  cy.wait('@aiDashboardConfig', { timeout: 15000 });
});

Then('the browser should be on the overview page', () => {
  cy.location('pathname', { timeout: 10000 }).should('match', /\/(console|ossmconsole)\/overview$/);
});

// ---- Tabs ------------------------------------------------------------------

Then('the AI dashboard Troubleshooting tab should be visible', () => {
  cy.get('[data-test="ai-dashboard-tab-troubleshooting"]', { timeout: 10000 }).should('be.visible');
});

Then('the AI dashboard Troubleshooting tab should not exist', () => {
  cy.get('[data-test="ai-dashboard-tab-troubleshooting"]').should('not.exist');
});

Then('the AI troubleshooting dashboard should be shown', () => {
  cy.get('[data-test="ai-troubleshooting"]', { timeout: 10000 }).should('be.visible');
  cy.get('[data-test="ai-usage-page"]').should('not.exist');
});

Then('the AI dashboard AI User Usage tab should be visible', () => {
  cy.get('[data-test="ai-dashboard-tab-session-usage"]', { timeout: 10000 }).should('be.visible');
});

Then('the AI dashboard AI User Usage tab should not exist', () => {
  cy.get('[data-test="ai-dashboard-tab-session-usage"]').should('not.exist');
});

Then('the AI dashboard Consumption tab should be visible', () => {
  cy.get('[data-test="ai-dashboard-tab-consumption"]', { timeout: 10000 }).should('be.visible');
});

Then('the AI dashboard Consumption tab should not exist', () => {
  cy.get('[data-test="ai-dashboard-tab-consumption"]').should('not.exist');
});

Then('the AI dashboard Consumption tab should be enabled', () => {
  cy.get('[data-test="ai-dashboard-tab-consumption"]').should('not.have.attr', 'aria-disabled', 'true');
});

Then('the AI dashboard Consumption tab should be disabled', () => {
  cy.get('[data-test="ai-dashboard-tab-consumption"]').should('have.attr', 'aria-disabled', 'true');
});

Then('the AI Consumption page should be shown', () => {
  // Header controls are the stable signal that the Consumption tab content mounted.
  cy.get('[data-test="ai-consumption-tokens-cost-toggle"]', { timeout: 10000 }).should('be.visible');
});

// ---- AI User Usage page ----------------------------------------------------

Then('the AI User Usage page should show the current session area', () => {
  cy.get('[data-test="ai-usage-page"]', { timeout: 10000 }).should('be.visible');
  cy.contains('Current session').should('be.visible');
});

Then('the AI User Usage page should show chat disabled for the current session', () => {
  cy.get('[data-test="ai-usage-chat-disabled"]', { timeout: 10000 })
    .should('be.visible')
    .and('contain.text', 'Chat disabled (current session)');
  cy.contains('Current session').should('be.visible');
});

Then('the AI User Usage page should not show chat disabled for the current session', () => {
  cy.get('[data-test="ai-usage-page"]', { timeout: 10000 }).should('be.visible');
  cy.get('[data-test="ai-usage-chat-disabled"]').should('not.exist');
});

Then('the AI User Usage page should show historic metrics', () => {
  // Historic sections render when consumption.enabled is true (metrics feature).
  cy.contains('Current week usage', { timeout: 10000 }).should('be.visible');
  cy.get('[data-test="ai-usage-chart-toolbar"]').should('be.visible');
});

Then('the AI User Usage page should not show historic metrics', () => {
  cy.contains('Current week usage').should('not.exist');
  cy.get('[data-test="ai-usage-chart-toolbar"]').should('not.exist');
});

// ---- Troubleshooting Ask / Fix controls ------------------------------------

Then('the Ask AI button on troubleshooting problems should be enabled', () => {
  cy.get('[data-test="ai-troubleshooting-ask-chatbot"]', { timeout: 10000 }).first().should('not.be.disabled');
});

Then('the Ask AI button on troubleshooting problems should be disabled', () => {
  cy.get('[data-test="ai-troubleshooting-ask-chatbot"]', { timeout: 10000 }).first().should('be.disabled');
});

Then('the Fix with AI button on troubleshooting problems should be enabled', () => {
  cy.get('[data-test="ai-troubleshooting-analyze"]', { timeout: 10000 }).first().should('not.be.disabled');
});

Then('the Fix with AI button on troubleshooting problems should be disabled', () => {
  cy.get('[data-test="ai-troubleshooting-analyze"]', { timeout: 10000 }).first().should('be.disabled');
});

// ---- Notification badge / chatbot FAB --------------------------------------

Then('the notification badge should show the AI icon', () => {
  cy.get('[data-test="notifications-ai-icon"]', { timeout: 10000 }).should('exist');
});

Then('the notification badge should not show the AI icon', () => {
  cy.get('[data-test="notifications-ai-icon"]').should('not.exist');
});

Then('the AI chatbot toggle should be visible', () => {
  // FAB is mounted when ai.enabled && chat.enabled.
  cy.get('[data-test="ai-chatbot-toggle"]', { timeout: 10000 }).should('be.visible');
});

Then('the AI chatbot toggle should not exist', () => {
  cy.get('[data-test="ai-chatbot-toggle"]').should('not.exist');
});
