import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { autoNavigatePayload, multipleActionsPayload, singleActionPayload } from '../../utils/aiChatbotMocks';
import { aiChatbotOnly } from '../../utils/suite-tags';

test.describe('AI chatbot navigation actions', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('The AI chatbot responds with a single navigation action', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.expectAlwaysNavigateUnchecked();
    await aiChatbotPage.sendMessage('Please show my services in the namespace bookinfo', singleActionPayload);
    await aiChatbotPage.expectAnswerContains("I'm taking you to the services list for the bookinfo namespace now.");
    await aiChatbotPage.expectNavigationActionLinks(1);
  });

  test('The AI chatbot responds with multiple navigation actions', aiChatbotOnly, async ({ aiChatbotPage }) => {
    await aiChatbotPage.open();
    await aiChatbotPage.expectAlwaysNavigateUnchecked();
    await aiChatbotPage.sendMessage('Please show my services in the namespace bookinfo', multipleActionsPayload);
    await aiChatbotPage.expectAnswerContains("I'm taking you to the services list for the bookinfo namespace now.");
    await aiChatbotPage.expectNavigationActionLinks(2);
  });

  test(
    'The AI chatbot auto-navigates when always navigate is enabled',
    aiChatbotOnly,
    async ({ page, aiChatbotPage }) => {
      await aiChatbotPage.open();
      await aiChatbotPage.setAlwaysNavigate(true);
      await aiChatbotPage.sendMessage('Can you navigate to services in bookinfo ?', autoNavigatePayload);
      await aiChatbotPage.expectAnswerContains('Sure, I can navigate you to the services in the bookinfo namespace.');
      await aiChatbotPage.expectNavigationActionsHidden();
      await expect(page).toHaveURL(/\/services\?.*namespaces=bookinfo/);
    }
  );
});
