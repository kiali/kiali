import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { mockPayload, SECOND_PROVIDER_NAME } from '../../utils/aiChatbotMocks';
import {
  injectSecondAiProviderInConfig,
  mockChatAiResponse,
  waitForChatAiPost,
  type ChatRequestCapture
} from '../../utils/aiChatbotHelpers';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot new chat and provider', () => {
  test('The New Chat button opens the confirmation modal', aiChatbotOnly, async ({ overviewPage, aiChatbotPage }) => {
    await overviewPage.open();
    await aiChatbotPage.open();
    await aiChatbotPage.sendMessage('Hello, this is a test message');
    await aiChatbotPage.expectAnswerContains('Of course.');
    await aiChatbotPage.clickNewChat();
    await aiChatbotPage.expectNewChatModalOpen();
  });

  test(
    'The new chat modal shows the erase conversation message when opened from the new chat button',
    aiChatbotOnly,
    async ({ overviewPage, aiChatbotPage }) => {
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.clickNewChat();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.expectEraseConversationMessage();
    }
  );

  test(
    'The new chat modal shows the provider change message when opened by selecting a different provider',
    aiChatbotOnly,
    async ({ page, overviewPage, aiChatbotPage }) => {
      await injectSecondAiProviderInConfig(page);
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.selectSecondProvider();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.expectProviderChangeMessage();
    }
  );

  test(
    'Cancelling the new chat modal keeps the conversation intact',
    aiChatbotOnly,
    async ({ overviewPage, aiChatbotPage }) => {
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.clickNewChat();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.cancelNewChatModal();
      await aiChatbotPage.expectNewChatModalClosed();
      await aiChatbotPage.expectAnswerContains('Of course.');
    }
  );

  test(
    'Closing the new chat modal with X keeps the conversation intact',
    aiChatbotOnly,
    async ({ overviewPage, aiChatbotPage }) => {
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.clickNewChat();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.closeNewChatModalWithX();
      await aiChatbotPage.expectNewChatModalClosed();
      await aiChatbotPage.expectAnswerContains('Of course.');
    }
  );

  test(
    'Confirming a new chat clears the conversation and resets the session',
    aiChatbotOnly,
    async ({ page, overviewPage, aiChatbotPage }) => {
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.clickNewChat();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.confirmNewChatModal();
      await aiChatbotPage.expectNewChatModalClosed();
      await aiChatbotPage.expectOpen();
      await aiChatbotPage.expectWelcomeMessage();
      await aiChatbotPage.expectNotContainText('Of course.');

      const capture: ChatRequestCapture = {};
      await mockChatAiResponse(page, mockPayload, { capture });
      const responsePromise = waitForChatAiPost(page);
      await aiChatbotPage.messageInput().fill('fresh start');
      await aiChatbotPage.sendButton().click();
      await responsePromise;
      expect(capture.body?.conversation_id ?? '').toBe('');
    }
  );

  test(
    'Selecting a different AI provider opens the new chat confirmation modal',
    aiChatbotOnly,
    async ({ page, overviewPage, aiChatbotPage }) => {
      await injectSecondAiProviderInConfig(page);
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.selectSecondProvider();
      await aiChatbotPage.expectNewChatModalOpen();
    }
  );

  test(
    'Confirming a provider change updates the selected provider and clears the chat',
    aiChatbotOnly,
    async ({ page, overviewPage, aiChatbotPage }) => {
      await injectSecondAiProviderInConfig(page);
      await overviewPage.open();
      await aiChatbotPage.open();
      await aiChatbotPage.sendMessage('Hello, this is a test message');
      await aiChatbotPage.expectAnswerContains('Of course.');
      await aiChatbotPage.selectSecondProvider();
      await aiChatbotPage.expectNewChatModalOpen();
      await aiChatbotPage.confirmNewChatModal();
      await aiChatbotPage.expectNewChatModalClosed();
      await aiChatbotPage.expectWelcomeMessage();
      await aiChatbotPage.expectNotContainText('Of course.');
      await aiChatbotPage.expectHeaderShowsProvider(SECOND_PROVIDER_NAME);

      const capture: ChatRequestCapture = {};
      await mockChatAiResponse(page, mockPayload, {
        capture,
        urlPattern: `**/api/chat/${SECOND_PROVIDER_NAME}/**/ai`
      });
      const responsePromise = waitForChatAiPost(page);
      await aiChatbotPage.messageInput().fill('new provider fresh start');
      await aiChatbotPage.sendButton().click();
      await responsePromise;
      expect(capture.provider).toBe(SECOND_PROVIDER_NAME);
      expect(capture.body?.conversation_id ?? '').toBe('');
    }
  );
});
