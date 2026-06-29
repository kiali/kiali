import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';
import {
  autoNavigatePayload,
  cancelledStreamPayload,
  createMockStreamResponse,
  createMockStreamResponseNoEnd,
  createMockStreamResponseWithError,
  fileCreateYamlPayload,
  fileDeleteYamlPayload,
  filePatchYamlPayload,
  mockPayload,
  multiFileActionsPayload,
  multipleActionsPayload,
  singleActionPayload,
  toolErrorPayload,
  toolRunningPayload,
  toolSuccessPayload,
  toolWithArgsPayload
} from './ai_chatbot_mocks';
import { ensureKialiFinishedLoading } from './transition';

const CHATBOT_TOGGLE = '[data-test="ai-chatbot-toggle"]';
const CHATBOT_STOP_BUTTON = '.pf-chatbot__button--stop';
const CHATBOT_TOGGLE_ICON_LIGHT = '[data-test="ai-chatbot-toggle-icon-light"]';
const CHATBOT_TOGGLE_ICON_DARK = '[data-test="ai-chatbot-toggle-icon-dark"]';
const THEME_SWITCH_DARK = 'button[aria-label="Dark theme"]';
const THEME_SWITCH_LIGHT = 'button[aria-label="Light theme"]';
const CHATBOT_VISIBLE = '.pf-chatbot.pf-chatbot--visible';
const CHATBOT_HIDDEN = '.pf-chatbot.pf-chatbot--hidden';
const CHATBOT_WELCOME_TITLE = '.pf-chatbot__hello';
const CHATBOT_WELCOME_DESCRIPTION = '.pf-chatbot__question';
const CHATBOT_MESSAGE_INPUT = '[data-testid="chatbot-message-bar-input"]';
const CHATBOT_TOOL_LABEL = (name: string): string => `[data-test="ai-tool-label-${name}"]`;
const CHATBOT_TOOL_MODAL = '[data-test="ai-tool-modal"]';
const CHATBOT_SEND_BUTTON = '.pf-chatbot__button--send';
const CHATBOT_DANGER_ALERT = '.pf-v6-c-alert.pf-m-danger';
const CHATBOT_SOURCES = '.pf-chatbot__source';
const CHATBOT_ALWAYS_NAVIGATE_SWITCH = '[data-testid="chatbot-always-navigate-switch"]';
const CHATBOT_NAVIGATION_ACTION = '[data-testid="chatbot-navigation-action"]';
const CHATBOT_NAVIGATION_ACTION_LINK = '[data-testid^="chatbot-navigation-action-link-"]';
/** PF6 / chatbot: file chip is a clickable button; truncated text omits the extension (e.g. vs-ai-cypress.yaml → vs-ai-cypress). */
const CHATBOT_FILE_ATTACHMENT_CONTENTS = '.pf-chatbot__file-label-contents';
const CHATBOT_YAML_MODAL = '[data-ouia-component-id="chatbot-yaml-modal"]';
const AI_CHATBOT_TEST_VS = 'vs-ai-cypress';
/** Istio Config list page uses VirtualList rows: data-test="VirtualItem_Ns{ns}_VirtualService_{name}" or VirtualItem_Cluster*_*Ns{ns}_VirtualService_{name}". */
const AI_CHATBOT_ISTIO_NS = 'bookinfo';

function virtualIstioConfigRowSelector(namespace: string, kind: string, name: string): string {
  return `[data-test*="_Ns${namespace}_${kind}_${name}"]`;
}

let lastResponseAlias = '';

function sendMessageWithMockedResponse(message: string, payload: object, alias: string): void {
  lastResponseAlias = alias;

  cy.intercept('POST', '**/api/chat/**/ai', {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream'
    },
    body: createMockStreamResponse(payload)
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

// ============================================================
// Theme-aware toggle icon
// ============================================================

/**
 * Guarantees light theme before the icon-variant test.
 * Needed because localStorage persists between test runs and could leave the
 * browser in dark mode, causing the icon data-test to be "…-dark" instead.
 */
Given('the theme is explicitly set to light', () => {
  // Remove the dark-mode class if it was toggled by a previous test
  cy.get('html').then($html => {
    if ($html.hasClass('pf-v6-theme-dark')) {
      cy.get(THEME_SWITCH_LIGHT).click();
      cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
    }
  });
  // Clear the persisted preference so future page loads also start in light mode
  cy.window().then(win => win.localStorage.removeItem('KIALI_THEME'));
});

/**
 * The chatbot must be CLOSED for the closedToggleIcon to be rendered.
 * The Background always starts at the overview page with the chatbot closed,
 * so no extra setup is needed.
 */
Then('the AI chatbot toggle should show the light theme icon', () => {
  cy.get(CHATBOT_TOGGLE_ICON_LIGHT, { timeout: 5000 }).should('exist');
  cy.get(CHATBOT_TOGGLE_ICON_DARK).should('not.exist');
});

Then('the AI chatbot toggle should show the dark theme icon', () => {
  cy.get(CHATBOT_TOGGLE_ICON_DARK, { timeout: 5000 }).should('exist');
  cy.get(CHATBOT_TOGGLE_ICON_LIGHT).should('not.exist');
});

When('the user switches to dark theme', () => {
  cy.get(THEME_SWITCH_DARK).click();
  // Wait for the Redux state and DOM to update
  cy.get('html').should('have.class', 'pf-v6-theme-dark');
});

When('the user switches to light theme', () => {
  cy.get(THEME_SWITCH_LIGHT).click();
  cy.get('html').should('not.have.class', 'pf-v6-theme-dark');
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

/**
 * Sends a message using a mock SSE stream that has no `end` event.
 * This keeps isStreaming:true in Redux so the stop button stays visible.
 */
When('user sends a message that starts streaming {string}', (message: string) => {
  lastResponseAlias = 'chatAIStreamNoEnd';
  cy.intercept('POST', '**/api/chat/**/ai', {
    statusCode: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: createMockStreamResponseNoEnd(cancelledStreamPayload)
  }).as('chatAIStreamNoEnd');
  cy.get(CHATBOT_MESSAGE_INPUT).type(message);
  cy.get(CHATBOT_SEND_BUTTON).click();
});

Then('the AI chatbot stop button should be visible', () => {
  cy.wait('@chatAIStreamNoEnd', { timeout: 10000 });
  cy.get(CHATBOT_STOP_BUTTON, { timeout: 10000 }).should('be.visible');
});

When('user clicks the stop button', () => {
  cy.get(CHATBOT_STOP_BUTTON).click();
});

Then('the AI chatbot should show a cancelled alert', () => {
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).should('contain.text', 'Cancelled');
});

Then('the AI chatbot should display a sources card', () => {
  cy.wait('@chatAIResponse', { timeout: 10000 })
    .its('response')
    .then(response => {
      expect(response?.statusCode).to.eq(200);
      // Since it's a mocked SSE stream, we just verify the mockPayload directly for the test assertions
      const docs = mockPayload.referenced_docs;
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

When('user sends a message with YAML create action {string}', (message: string) => {
  sendMessageWithMockedResponse(message, fileCreateYamlPayload, 'chatAIYamlResponse');
});

When('user sends a message with YAML patch action {string}', (message: string) => {
  sendMessageWithMockedResponse(message, filePatchYamlPayload, 'chatAIYamlResponse');
});

When('user sends a message with YAML delete action {string}', (message: string) => {
  sendMessageWithMockedResponse(message, fileDeleteYamlPayload, 'chatAIYamlResponse');
});

When('user opens the chatbot YAML attachment {string}', (fileName: string) => {
  const baseName = fileName.lastIndexOf('.') > 0 ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 })
    .contains(CHATBOT_FILE_ATTACHMENT_CONTENTS, baseName)
    .parents('button.pf-m-clickable')
    .first()
    .click();
});

// ============================================================
// Multiple file attachments (FileAttachment component)
// ============================================================

/**
 * Sends a message whose mocked `end` event carries two file actions
 * (DestinationRule + VirtualService), exercising the multi-attachment path
 * in Actions.tsx / FileAttachment.tsx.
 */
When('user sends a message with multiple file actions {string}', (message: string) => {
  sendMessageWithMockedResponse(message, multiFileActionsPayload, 'chatAIMultiFileResponse');
});

Then('the AI chatbot should display the file attachment label {string}', (label: string) => {
  // label is the base filename without extension, e.g. "dr_reviews"
  // Do NOT cy.wait here — this step is called once per label (multiple times per scenario),
  // so the alias would only match the first call. cy.get with timeout retries automatically.
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).contains(CHATBOT_FILE_ATTACHMENT_CONTENTS, label).should('exist');
});

Then('the chatbot YAML attachment modal should be open', () => {
  cy.get(CHATBOT_YAML_MODAL, { timeout: 10000 }).should('be.visible');
});

Then('the chatbot YAML attachment modal should contain {string} in the editor', (snippet: string) => {
  cy.get(CHATBOT_YAML_MODAL, { timeout: 10000 }).find('.monaco-editor .view-lines').should('contain.text', snippet);
});

When('user closes the chatbot YAML attachment modal', () => {
  cy.get(CHATBOT_YAML_MODAL).within(() => {
    cy.contains('button', 'Close').click();
  });
});

Then('the chatbot YAML attachment modal should be closed', () => {
  cy.get(CHATBOT_YAML_MODAL).should('not.exist');
});

/**
 * Intercepts the DestinationRule POST endpoint with a mocked 200 response so
 * we can verify the API is called without needing a real Kubernetes cluster.
 */
When('user confirms YAML create for the DestinationRule attachment', () => {
  cy.intercept('POST', '**/api/namespaces/bookinfo/istio/networking.istio.io/v1/DestinationRule', {
    statusCode: 200,
    body: {}
  }).as('istioYamlApply');
  cy.get(CHATBOT_YAML_MODAL).should('be.visible');
  cy.get(CHATBOT_YAML_MODAL).within(() => {
    cy.contains('button', 'Create').click();
  });
});

/**
 * Generic text check on the visible chatbot area — more flexible than
 * `the AI chatbot should show YAML apply success for` which is tied to the
 * `vs-ai-cypress` resource name.
 */
Then('the AI chatbot should contain the text {string}', (text: string) => {
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).should('contain.text', text);
});

When('user confirms YAML create in the chatbot modal', () => {
  cy.intercept('POST', '**/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService', req => {
    req.continue();
  }).as('istioYamlApply');
  cy.get(CHATBOT_YAML_MODAL).should('be.visible');
  cy.get(CHATBOT_YAML_MODAL).within(() => {
    cy.contains('button', 'Create').click();
  });
});

When('user confirms YAML patch in the chatbot modal', () => {
  cy.intercept(
    'PATCH',
    '**/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/vs-ai-cypress*',
    req => {
      req.continue();
    }
  ).as('istioYamlApply');
  cy.get(CHATBOT_YAML_MODAL).should('be.visible');
  cy.get(CHATBOT_YAML_MODAL).within(() => {
    cy.contains('button', 'Patch').click();
  });
});

When('user confirms YAML delete in the chatbot modal', () => {
  cy.intercept(
    'DELETE',
    '**/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/vs-ai-cypress*',
    req => {
      req.continue();
    }
  ).as('istioYamlApply');
  cy.get(CHATBOT_YAML_MODAL).should('be.visible');
  cy.get(CHATBOT_YAML_MODAL).within(() => {
    cy.contains('button', 'Delete').click();
  });
});

Then('the Istio YAML apply request should succeed with method {string}', (method: string) => {
  cy.wait('@istioYamlApply', { timeout: 10000 }).then(interception => {
    expect(interception.response?.statusCode).to.eq(200);
    expect(interception.request.method).to.eq(method);
  });
});

Then('the AI chatbot should show YAML apply success for {string}', (operation: string) => {
  const label: Record<string, string> = {
    create: 'Successfully created',
    patch: 'Successfully patched',
    delete: 'Successfully deleted'
  };
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).should('contain.text', label[operation]);
  cy.get(CHATBOT_VISIBLE).should('contain.text', AI_CHATBOT_TEST_VS);
});

When('user views the Istio Config list for namespaces {string}', (namespaces: string) => {
  cy.visit({
    url: `${Cypress.config('baseUrl')}/console/istio`,
    qs: { refresh: '0', namespaces }
  });
  ensureKialiFinishedLoading();
  cy.get('[data-test="refresh-button"]').click();
  ensureKialiFinishedLoading();
});

When(
  'user opens Istio Config details for VirtualService {string} in namespace {string}',
  (vsName: string, namespace: string) => {
    cy.visit({
      url: `${Cypress.config(
        'baseUrl'
      )}/console/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService/${vsName}`,
      qs: { refresh: '0' }
    });
    ensureKialiFinishedLoading();
  }
);

Then('user sees VirtualService {string} in the Istio Config list', (name: string) => {
  const rowSel = virtualIstioConfigRowSelector(AI_CHATBOT_ISTIO_NS, 'VirtualService', name);
  cy.get(rowSel, { timeout: 45000 }).should('exist').and('be.visible');
});

Then('user does not see VirtualService {string} in the Istio Config list', (name: string) => {
  const rowSel = virtualIstioConfigRowSelector(AI_CHATBOT_ISTIO_NS, 'VirtualService', name);
  cy.get('[data-test="refresh-button"]').click();
  ensureKialiFinishedLoading();
  cy.get(rowSel).should('not.exist');
});

Then('the Istio config YAML editor should contain {string}', (snippet: string) => {
  cy.get('[data-test="istio-config-editor"] .monaco-editor', { timeout: 30000 }).should('be.visible');
  cy.get('[data-test="istio-config-editor"] .view-lines').invoke('text').should('include', snippet);
});

// ============================================================
// Display mode and Minimize
// ============================================================

When('the user clicks the {string} header button', (label: string) => {
  cy.get(CHATBOT_VISIBLE).find(`button[aria-label="${label}"]`).click();
});

/**
 * Verifies the Chatbot component class, which is driven by the displayMode value
 * stored in Redux (state.aiChat.displayMode). Pattern: pf-chatbot--{mode}.
 */
Then('the chatbot should be in {string} display mode', (mode: string) => {
  cy.get(`.pf-chatbot.pf-chatbot--${mode}`).should('exist');
});

/**
 * Verifies that setDockedSize() ran and wrote --kiali-chatbot-docked-height.
 * setDockedSize is called inside a requestAnimationFrame, so we use cy.document().should()
 * which retries until the assertion passes.
 */
Then('the chatbot docked height CSS variable should be set', () => {
  cy.document().should(doc => {
    const val = doc.documentElement.style.getPropertyValue('--kiali-chatbot-docked-height').trim();
    expect(val, '--kiali-chatbot-docked-height').to.match(/^\d+(\.\d+)?px$/);
  });
});

/**
 * Verifies that setDockedSize() wrote both fullscreen CSS custom properties.
 */
Then('the chatbot fullscreen size CSS variables should be set', () => {
  cy.document().should(doc => {
    const style = doc.documentElement.style;
    const h = style.getPropertyValue('--kiali-chatbot-fullscreen-height').trim();
    const w = style.getPropertyValue('--kiali-chatbot-fullscreen-width').trim();
    expect(h, '--kiali-chatbot-fullscreen-height').to.match(/^\d+(\.\d+)?px$/);
    expect(w, '--kiali-chatbot-fullscreen-width').to.match(/^\d+(\.\d+)?px$/);
  });
});

// ============================================================
// New Chat modal and provider switching
// ============================================================

const NEW_CHAT_BUTTON = 'button[aria-label="Clear chat"]';
const NEW_CHAT_MODAL = '[data-test="new-chat-modal"]';
const NEW_CHAT_CONFIRM = '[data-test="new-chat-confirm"]';
const NEW_CHAT_CANCEL = '[data-test="new-chat-cancel"]';
const NEW_CHAT_MODAL_CLOSE_X = `${NEW_CHAT_MODAL} button[aria-label="Close"]`;
/** Name injected by the "two AI providers are configured" step. */
const SECOND_PROVIDER_NAME = 'second-test-provider';

When('user clicks the new chat button', () => {
  cy.get(CHATBOT_VISIBLE).find(NEW_CHAT_BUTTON).click();
});

Then('the new chat confirmation modal should be open', () => {
  cy.get(NEW_CHAT_MODAL, { timeout: 10000 }).should('be.visible');
  cy.get(NEW_CHAT_MODAL).should('contain.text', 'Confirm chat deletion');
});

When('user cancels the new chat modal', () => {
  cy.get(NEW_CHAT_CANCEL).click();
});

When('user closes the new chat modal with X', () => {
  cy.get(NEW_CHAT_MODAL_CLOSE_X).click();
});

When('user confirms the new chat modal', () => {
  cy.get(NEW_CHAT_CONFIRM).click();
});

Then('the new chat modal should be closed', () => {
  cy.get(NEW_CHAT_MODAL).should('not.exist');
});

/**
 * Verifies the modal body when triggered from the "New chat" header button
 * (providerChanged=false path in NewChatModal.tsx).
 */
Then('the new chat modal should show the erase conversation message', () => {
  cy.get(NEW_CHAT_MODAL).should(
    'contain.text',
    'Are you sure you want to erase the current chat conversation and start a new chat?'
  );
});

/**
 * Verifies the modal body when triggered by selecting a different AI provider
 * (providerChanged=true path in NewChatModal.tsx).
 */
Then('the new chat modal should show the provider change message', () => {
  cy.get(NEW_CHAT_MODAL).should('contain.text', 'Changing the AI provider requires starting a new chat.');
});

Then('the AI chatbot should still contain the message {string}', (message: string) => {
  cy.get(CHATBOT_VISIBLE).should('contain.text', message);
});

Then('the AI chatbot should not contain the message {string}', (message: string) => {
  cy.get(CHATBOT_VISIBLE).should('not.contain.text', message);
});

/**
 * Finds the Redux store by walking UP the React fiber tree from a known DOM element.
 * react-redux v7 stores { store, subscription } in the Context.Provider fiber's
 * memoizedProps.value, and the same { store } in the Provider function component's
 * first useMemo hook (memoizedState.memoizedState).
 * Walking UP via node.return from any element inside the Provider guarantees we
 * reach those fibers without any source modifications.
 */
function getReduxStoreFromFiber(win: Window): any {
  // Must cy.get() first so querySelector finds the element (no retry in querySelector)
  const anchor = (win.document as any).querySelector('[data-test="ai-chatbot-toggle"]');
  if (!anchor) return null;

  const fiberKey = Object.keys(anchor).find(
    (k: string) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
  );
  if (!fiberKey) return null;

  let node = anchor[fiberKey];
  while (node) {
    const ctxStore = node.memoizedProps?.value?.store;
    if (ctxStore?.dispatch && ctxStore?.getState) return ctxStore;

    const hooksStore = node.memoizedState?.memoizedState?.store;
    if (hooksStore?.dispatch && hooksStore?.getState) return hooksStore;

    const pendingStore = node.pendingProps?.value?.store;
    if (pendingStore?.dispatch && pendingStore?.getState) return pendingStore;

    node = node.return;
  }
  return null;
}

/**
 * Injects a second AI provider directly into Redux via the React fiber tree.
 * No source-code modifications required — works in any development/test build
 * because React attaches its fiber to every DOM node via __reactFiber$xxx.
 */
Given('two AI providers are configured', () => {
  // cy.get() retries until the element exists; querySelector does not
  cy.get('[data-test="ai-chatbot-toggle"]').should('exist');

  cy.window().then(win => {
    const store = getReduxStoreFromFiber(win);
    if (!store) {
      throw new Error(
        'Could not find the Redux store via the React fiber tree. ' +
          'Ensure the app is running in development/test mode.'
      );
    }

    const aiState = store.getState().aiChat;
    const realProviders: any[] = (aiState.providers ?? []).filter((p: any) => p.name !== SECOND_PROVIDER_NAME);

    if (realProviders.length === 0) {
      throw new Error('No AI provider is configured in this cluster — cannot run provider-switch test.');
    }

    if ((aiState.providers ?? []).some((p: any) => p.name === SECOND_PROVIDER_NAME)) {
      return; // already injected
    }

    const first = realProviders[0];
    const models: any[] =
      Array.isArray(first.models) && first.models.length > 0
        ? first.models
        : [{ name: 'test-model', model: 'test-model', enabled: true }];

    store.dispatch({
      type: 'CHAT_AI_SET_CHAT_AI',
      payload: {
        enabled: aiState.enabled,
        defaultProvider: aiState.defaultProvider || first.name,
        providers: [
          ...realProviders,
          {
            name: SECOND_PROVIDER_NAME,
            type: first.type ?? 'openai',
            config: first.config ?? 'default',
            enabled: true,
            defaultModel: models[0].name,
            models
          }
        ]
      }
    });
  });
});

When('user selects the second AI provider', () => {
  // Open the selector dropdown.
  cy.get('.pf-chatbot__header').find('button.pf-v6-c-menu-toggle').first().click();
  // The provider name is a non-clickable DropdownGroup heading (<h3>); the actual
  // selectable entries are DropdownItem buttons showing model names underneath it.
  // Navigate from the group title up to the group container, then click its first item.
  cy.contains('.pf-v6-c-menu__group-title', SECOND_PROVIDER_NAME)
    .closest('.pf-v6-c-menu__group')
    .find('button.pf-v6-c-menu__item')
    .first()
    .click();
});

Then('the AI chatbot header should show the second provider as selected', () => {
  // The MenuToggle button shows the selected value as its text content
  cy.get('.pf-chatbot__header').find('button.pf-v6-c-menu-toggle').first().should('contain.text', SECOND_PROVIDER_NAME);
});

/**
 * Verifies that setConversationID({ id: undefined }) was dispatched by confirming
 * that the next outgoing chat request carries an empty (or absent) conversation_id.
 * This is the only way to observe this Redux state change from Cypress.
 */
Then('the next chat message should be sent without a conversation ID', () => {
  cy.intercept('POST', '**/api/chat/**/ai', req => {
    // conversation_id must be absent or empty — proving setConversationID({id:undefined}) ran
    const convId = req.body?.conversation_id;
    expect(convId ?? '').to.equal('', 'conversation_id must be empty after chat reset');
    req.reply({
      statusCode: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: createMockStreamResponse(mockPayload)
    });
  }).as('freshConversation');

  cy.get(CHATBOT_MESSAGE_INPUT).type('fresh start');
  cy.get(CHATBOT_SEND_BUTTON).click();
  cy.wait('@freshConversation', { timeout: 10000 });
});

/**
 * Verifies that setSelectedProvider / setSelectedModel were dispatched by confirming
 * that the next chat request URL contains the new provider name, AND that the
 * conversation_id is empty (proving setConversationID({id:undefined}) also ran).
 */
Then('the next chat message should be sent to the second AI provider without a conversation ID', () => {
  cy.intercept('POST', `**/api/chat/${SECOND_PROVIDER_NAME}/**/ai`, req => {
    const convId = req.body?.conversation_id;
    expect(convId ?? '').to.equal('', 'conversation_id must be empty after provider change + chat reset');
    req.reply({
      statusCode: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: createMockStreamResponse(mockPayload)
    });
  }).as('secondProviderFreshConversation');

  cy.get(CHATBOT_MESSAGE_INPUT).type('new provider fresh start');
  cy.get(CHATBOT_SEND_BUTTON).click();
  cy.wait('@secondProviderFreshConversation', { timeout: 10000 });
});

// ============================================================
// Tool call / tool result rendering
// ============================================================

When('user sends a message triggering a running tool {string}', (message: string) => {
  // toolRunningPayload has only tool_call — no tool_result — so the label stays isRunning:true
  sendMessageWithMockedResponse(message, toolRunningPayload, 'chatAIToolRunning');
});

When('user sends a message triggering a successful tool {string}', (message: string) => {
  sendMessageWithMockedResponse(message, toolSuccessPayload, 'chatAIToolSuccess');
});

When('user sends a message triggering a failed tool {string}', (message: string) => {
  sendMessageWithMockedResponse(message, toolErrorPayload, 'chatAIToolError');
});

When('user sends a message triggering a tool with arguments {string}', (message: string) => {
  sendMessageWithMockedResponse(message, toolWithArgsPayload, 'chatAIToolArgs');
});

Then('the AI chatbot should show a running tool label for {string}', (toolName: string) => {
  cy.wait('@chatAIToolRunning', { timeout: 10000 });
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 })
    .find(CHATBOT_TOOL_LABEL(toolName))
    .should('exist')
    .find('.pf-v6-c-spinner')
    .should('exist');
});

Then('the AI chatbot should show a completed tool label for {string}', (toolName: string) => {
  // Use the last response alias so this step works for both success and args scenarios
  cy.wait(`@${lastResponseAlias}`, { timeout: 10000 });
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 })
    .find(CHATBOT_TOOL_LABEL(toolName))
    .should('exist')
    .and('not.have.class', 'pf-m-red')
    .find('.pf-v6-c-spinner')
    .should('not.exist');
});

Then('the AI chatbot should show an error tool label for {string}', (toolName: string) => {
  cy.wait('@chatAIToolError', { timeout: 10000 });
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 })
    .find(CHATBOT_TOOL_LABEL(toolName))
    .should('exist')
    .and('have.class', 'pf-m-red');
});

When('user clicks the tool label for {string}', (toolName: string) => {
  cy.get(CHATBOT_VISIBLE).find(CHATBOT_TOOL_LABEL(toolName)).click();
});

Then('the AI chatbot tool modal should be open', () => {
  cy.get(CHATBOT_TOOL_MODAL, { timeout: 10000 }).should('be.visible');
});

Then('the AI chatbot tool modal should show {string} status', (expectedStatus: string) => {
  cy.get(CHATBOT_TOOL_MODAL).should('contain.text', expectedStatus);
});

Then('the AI chatbot tool modal should display tool output content', () => {
  // The ToolModal renders completed content inside a CodeBlock
  cy.get(CHATBOT_TOOL_MODAL).find('code').should('exist').and('not.be.empty');
});

Then('the AI chatbot tool modal should display tool arguments containing {string}', (args: string) => {
  // The modal formats args as key=value pairs in the description text
  cy.get(CHATBOT_TOOL_MODAL).should('contain.text', args);
});

// ============================================================
// Error handling — HTTP error and SSE error event
// ============================================================

When('user sends a message that returns a server error {string}', (message: string) => {
  lastResponseAlias = 'chatAIServerError';
  cy.intercept('POST', '**/api/chat/**/ai', {
    statusCode: 500,
    body: {}
  }).as('chatAIServerError');
  cy.get(CHATBOT_MESSAGE_INPUT).type(message);
  cy.get(CHATBOT_SEND_BUTTON).click();
});

When('user sends a message that triggers a stream error {string}', (message: string) => {
  lastResponseAlias = 'chatAIStreamError';
  cy.intercept('POST', '**/api/chat/**/ai', {
    statusCode: 200,
    headers: { 'Content-Type': 'text/event-stream' },
    body: createMockStreamResponseWithError('Connection refused by LLM provider')
  }).as('chatAIStreamError');
  cy.get(CHATBOT_MESSAGE_INPUT).type(message);
  cy.get(CHATBOT_SEND_BUTTON).click();
});

Then('the AI chatbot should show a danger error alert', () => {
  cy.wait(`@${lastResponseAlias}`, { timeout: 10000 });
  cy.get(CHATBOT_VISIBLE, { timeout: 10000 }).find(CHATBOT_DANGER_ALERT).should('exist');
});

// ============================================================
// Interaction mode switching (ask/troubleshoot)
// ============================================================

const CHATBOT_MODE_TOGGLE = '[data-testid="chatbot-interaction-mode-toggle"]';

When('the user opens the interaction mode dropdown', () => {
  cy.get(CHATBOT_VISIBLE).find(CHATBOT_MODE_TOGGLE).click();
  // Wait for dropdown to be visible
  cy.get('.pf-v6-c-menu').should('be.visible');
});

When('the user selects {string} interaction mode', (mode: string) => {
  // The dropdown items are rendered by text content in a PatternFly menu
  cy.contains('.pf-v6-c-menu__item', mode === 'ask' ? 'Ask' : 'Troubleshoot').click();
});

Then('the interaction mode should be {string}', (mode: string) => {
  const expectedText = mode === 'ask' ? 'Ask' : 'Troubleshoot';
  cy.get(CHATBOT_MODE_TOGGLE).should('contain.text', expectedText);
});

Then('the message input placeholder should say {string}', (placeholder: string) => {
  cy.get(CHATBOT_MESSAGE_INPUT).should('have.attr', 'placeholder', placeholder);
});

Then('the interaction mode dropdown should show {string} option', (mode: string) => {
  const text = mode === 'ask' ? 'Ask' : 'Troubleshoot';
  cy.get('.pf-v6-c-menu').should('be.visible').and('contain.text', text);
});

Then('the interaction mode dropdown should show {string} description', (description: string) => {
  cy.get('.pf-v6-c-menu').should('be.visible').and('contain.text', description);
});
