import { test } from '../../fixtures/kialiFixtures';
import { mockChatAiServerError, mockChatAiStreamError, waitForChatAiPost } from '../../utils/aiChatbotHelpers';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot errors and interaction modes', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test(
    'The AI chatbot shows a danger error alert when the backend returns a server error',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      await aiChatbotPage.open();
      await mockChatAiServerError(page);
      const responsePromise = waitForChatAiPost(page);
      await aiChatbotPage.messageInput().fill('What is the mesh status?');
      await aiChatbotPage.sendButton().click();
      await responsePromise;
      await aiChatbotPage.expectDangerErrorAlert();
    }
  );

  test(
    'The AI chatbot shows a danger error alert when the stream contains an error event',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      await aiChatbotPage.open();
      await mockChatAiStreamError(page, 'Connection refused by LLM provider');
      const responsePromise = waitForChatAiPost(page);
      await aiChatbotPage.messageInput().fill('What is the mesh status?');
      await aiChatbotPage.sendButton().click();
      await responsePromise;
      await aiChatbotPage.expectDangerErrorAlert();
    }
  );

  test('The AI chatbot defaults to ask mode', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.expectInteractionMode('ask');
    await aiChatbotPage.expectMessagePlaceholder('Ask a question...');
  });

  test('The user can switch from ask mode to troubleshoot mode', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.expectInteractionMode('ask');
    await aiChatbotPage.openInteractionModeDropdown();
    await aiChatbotPage.selectInteractionMode('troubleshoot');
    await aiChatbotPage.expectInteractionMode('troubleshoot');
    await aiChatbotPage.expectMessagePlaceholder('Describe the issue...');
  });

  test('The user can switch from troubleshoot mode to ask mode', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.openInteractionModeDropdown();
    await aiChatbotPage.selectInteractionMode('troubleshoot');
    await aiChatbotPage.expectInteractionMode('troubleshoot');
    await aiChatbotPage.openInteractionModeDropdown();
    await aiChatbotPage.selectInteractionMode('ask');
    await aiChatbotPage.expectInteractionMode('ask');
    await aiChatbotPage.expectMessagePlaceholder('Ask a question...');
  });

  test('The interaction mode is sent with chat requests', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.openInteractionModeDropdown();
    await aiChatbotPage.selectInteractionMode('troubleshoot');
    await aiChatbotPage.sendMessage('What is wrong with my services?');
    await aiChatbotPage.expectAnswerContains('Of course.');
  });

  test(
    'The interaction mode persists after closing and reopening the chatbot',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.openInteractionModeDropdown();
      await aiChatbotPage.selectInteractionMode('troubleshoot');
      await aiChatbotPage.expectInteractionMode('troubleshoot');
      await aiChatbotPage.clickToggle();
      await aiChatbotPage.expectClosed();
      await aiChatbotPage.clickToggle();
      await aiChatbotPage.expectOpen();
      await aiChatbotPage.expectInteractionMode('troubleshoot');
      await aiChatbotPage.expectMessagePlaceholder('Describe the issue...');
    }
  );

  test(
    'The interaction mode dropdown shows both ask and troubleshoot options',
    aiChatbotOnly,
    async ({ aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.openInteractionModeDropdown();
      await aiChatbotPage.expectInteractionModeOptionVisible('ask');
      await aiChatbotPage.expectInteractionModeOptionVisible('troubleshoot');
      await aiChatbotPage.expectInteractionModeDescription('Standard question and answer');
      await aiChatbotPage.expectInteractionModeDescription('Focused troubleshooting assistance');
    }
  );
});
